<template>
  <div class="app-container debug-workbench">
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-kicker">SDUI Debug</span>
        <h1>终端调试工作台</h1>
        <p>围绕真实设备执行命令和观测输入事件，所有标签共用同一设备上下文。</p>
      </div>

      <div class="hero-controls">
        <el-select
          v-model="selectedDeviceId"
          filterable
          clearable
          placeholder="选择设备"
          style="width: 320px"
          :loading="deviceLoading"
          @change="handleDeviceChange"
        >
          <el-option
            v-for="device in devices"
            :key="device.deviceId"
            :label="`${device.name} (${device.status === 'ONLINE' ? '在线' : '离线'})`"
            :value="device.deviceId"
          />
        </el-select>
        <el-tag :type="selectedDevice?.status === 'ONLINE' ? 'success' : 'info'" round>
          {{ selectedDevice ? (selectedDevice.status === 'ONLINE' ? '在线' : '离线') : '未选择设备' }}
        </el-tag>
        <el-button plain :loading="deviceLoading" @click="fetchDevices">刷新设备</el-button>
        <el-button type="primary" :disabled="!selectedDeviceId" :loading="pageLoading" @click="refreshActiveData">
          刷新当前标签
        </el-button>
      </div>
    </section>

    <section class="summary-grid">
      <article v-for="item in summaryCards" :key="item.label" class="summary-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.help }}</small>
      </article>
    </section>

    <el-card shadow="never" class="tabs-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="命令调试" name="command" />
        <el-tab-pane label="Section 调试" name="section" />
        <el-tab-pane label="事件观测" name="event" />
      </el-tabs>

      <template v-if="selectedDeviceId">
        <CommandDebugPanel
          v-if="activeTab === 'command'"
          :device-id="selectedDeviceId"
          :loading="commandLoading"
          :catalog="commandCatalog"
          :timeline="commandTimeline"
          :selected-detail="selectedCommandDetail"
          @refresh="loadCommandData"
          @record-created="upsertCommandRecord"
          @select-detail="fetchCommandDetail"
          @close-detail="selectedCommandDetail = null"
        />

        <SectionDebugPanel
          v-else-if="activeTab === 'section'"
          ref="sectionPanelRef"
          :device-id="selectedDeviceId"
          @summary-change="sectionSummary = $event"
        />

        <EventObserverPanel
          v-else
          :events="deviceEvents"
        />
      </template>

      <el-empty v-else description="先选择设备，再开始调试" :image-size="72" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue';
import { ElMessage } from 'element-plus';
import {
  getDebugCommandDetail,
  getDebugCommandHistory,
  getDebugCommandsSchema
} from '@/api/sdui';
import CommandDebugPanel from './components/CommandDebugPanel.vue';
import EventObserverPanel from './components/EventObserverPanel.vue';
import SectionDebugPanel from './components/SectionDebugPanel.vue';
import { normalizeCommandCatalog, normalizeCommandHistory, normalizeCommandHistoryItem } from './normalize';
import { useDebugDeviceContext } from './composables/useDebugDeviceContext';
import { useDebugStreams } from './composables/useDebugStreams';
import type { DebugCommandCatalog, DebugCommandHistoryItem, DebugEventStreamItem } from './types';

const activeTab = ref<'command' | 'section' | 'event'>('command');
const pageLoading = ref(false);
const commandLoading = ref(false);
const sectionPanelRef = ref<(ComponentPublicInstance & { refreshData: () => Promise<void> }) | null>(null);
const sectionSummary = ref({
  sectionTypeCount: 0,
  pageCount: 0,
  activeSectionCount: 0
});

const {
  devices,
  selectedDeviceId,
  selectedDevice,
  loading: deviceLoading,
  fetchDevices
} = useDebugDeviceContext();

const {
  commandConnected,
  eventConnected,
  startCommandStream,
  startEventStream,
  stopAllStreams
} = useDebugStreams();

const commandCatalog = ref<DebugCommandCatalog>({
  deviceId: '',
  online: false,
  deviceCommands: []
});
const commandTimeline = ref<DebugCommandHistoryItem[]>([]);
const selectedCommandDetail = ref<DebugCommandHistoryItem | null>(null);
const deviceEvents = ref<DebugEventStreamItem[]>([]);

const summaryCards = computed(() => [
  {
    label: '命令目录',
    value: commandCatalog.value.deviceCommands.length,
    help: `${commandCatalog.value.deviceCommands.length} 条可用命令`
  },
  {
    label: '命令回执流',
    value: commandConnected.value ? '已连接' : '未连接',
    help: `最近 ${commandTimeline.value.length} 条命令`
  },
  {
    label: activeTab.value === 'section' ? 'Section 类型' : '事件观测流',
    value: activeTab.value === 'section' ? sectionSummary.value.sectionTypeCount : (eventConnected.value ? '已连接' : '未连接'),
    help: activeTab.value === 'section'
      ? `${sectionSummary.value.pageCount} 个 page / 当前 ${sectionSummary.value.activeSectionCount} 个 section`
      : `最近 ${deviceEvents.value.length} 条事件`
  }
]);

watch(
  () => selectedDeviceId.value,
  async (deviceId) => {
    stopAllStreams();
    resetDeviceState();
    if (!deviceId) return;
    await refreshActiveData();
    startCommandStream(deviceId, upsertCommandRecord);
    startEventStream(deviceId, (item) => {
      deviceEvents.value = [item, ...deviceEvents.value].slice(0, 100);
    });
  }
);

watch(
  () => activeTab.value,
  () => {
    if (!selectedDeviceId.value) return;
    refreshActiveData();
  }
);

fetchDevices().catch(() => {
  ElMessage.error('加载设备列表失败');
});

function handleDeviceChange() {
  selectedCommandDetail.value = null;
}

function resetDeviceState() {
  commandCatalog.value = { deviceId: '', online: false, deviceCommands: [] };
  commandTimeline.value = [];
  deviceEvents.value = [];
  selectedCommandDetail.value = null;
  sectionSummary.value = {
    sectionTypeCount: 0,
    pageCount: 0,
    activeSectionCount: 0
  };
}

async function refreshActiveData() {
  if (!selectedDeviceId.value) return;
  pageLoading.value = true;
  try {
    if (activeTab.value === 'command') {
      await loadCommandData();
    } else if (activeTab.value === 'section') {
      await nextTick();
      await sectionPanelRef.value?.refreshData();
    }
  } finally {
    pageLoading.value = false;
  }
}

async function loadCommandData() {
  if (!selectedDeviceId.value) return;
  commandLoading.value = true;
  try {
    const [catalogResponse, historyResponse] = await Promise.all([
      getDebugCommandsSchema(selectedDeviceId.value),
      getDebugCommandHistory(selectedDeviceId.value, { limit: 20 })
    ]);

    commandCatalog.value = normalizeCommandCatalog(catalogResponse);
    commandTimeline.value = normalizeCommandHistory(historyResponse)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    ElMessage.error('加载命令调试数据失败');
  } finally {
    commandLoading.value = false;
  }
}

async function fetchCommandDetail(cmdId: string) {
  if (!selectedDeviceId.value) return;
  try {
    const response = await getDebugCommandDetail(selectedDeviceId.value, cmdId);
    selectedCommandDetail.value = normalizeCommandHistoryItem(response?.data || response || {});
  } catch {
    ElMessage.error('加载命令详情失败');
  }
}

function upsertCommandRecord(item: DebugCommandHistoryItem) {
  const next = [...commandTimeline.value];
  const index = next.findIndex((row) => row.cmdId === item.cmdId);
  if (index >= 0) {
    next[index] = { ...next[index], ...item };
  } else {
    next.unshift(item);
  }
  commandTimeline.value = next
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
}
</script>

<style scoped>
.debug-workbench {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero,
.hero-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.hero {
  padding: 24px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 34%),
    radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.18), transparent 28%),
    linear-gradient(135deg, #f8fafc, #f0f9ff 48%, #fff7ed);
}

.hero-kicker {
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 8px 0;
}

.hero-copy p {
  margin: 0;
  color: #475569;
  max-width: 720px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-card strong {
  font-size: 24px;
}

.summary-card small {
  color: #6b7280;
}

.tabs-card {
  border-radius: 24px;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
