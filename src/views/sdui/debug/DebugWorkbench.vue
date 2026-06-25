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

    <el-card shadow="never" class="tabs-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="命令调试" name="command" />
        <el-tab-pane label="Section 调试" name="section" />
      </el-tabs>

      <template v-if="selectedDeviceId">
        <CommandDebugPanel
          v-if="activeTab === 'command'"
          :device-id="selectedDeviceId"
          :loading="commandLoading"
          :catalog="commandCatalog"
          :timeline="commandTimeline"
          :audio-record-state="audioRecordState"
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
          :board="selectedDevice?.board || ''"
          :events="deviceEvents"
          :event-connected="eventConnected"
        />
      </template>

      <el-empty v-else description="先选择设备，再开始调试" :image-size="72" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type ComponentPublicInstance } from 'vue';
import { ElMessage } from 'element-plus';
import {
  getDebugAudioRecordArtifact,
  getDebugAudioRecordSession,
  getDebugCommandDetail,
  getDebugCommandHistory,
  getDebugCommandsSchema
} from '@/api/sdui';
import CommandDebugPanel from './components/CommandDebugPanel.vue';
import SectionDebugPanel from './components/SectionDebugPanel.vue';
import {
  applyAudioRecordArtifact,
  applyAudioRecordSession,
  createInitialAudioRecordState,
  normalizeAudioRecordArtifact,
  normalizeAudioRecordSession,
  normalizeCommandCatalog,
  normalizeCommandHistory,
  normalizeCommandHistoryItem,
  reduceAudioRecordState
} from './normalize';
import { useDebugDeviceContext } from './composables/useDebugDeviceContext';
import { useDebugStreams } from './composables/useDebugStreams';
import type {
  DebugAudioRecordState,
  DebugCommandCatalog,
  DebugCommandHistoryItem,
  DebugEventStreamItem
} from './types';

const activeTab = ref<'command' | 'section'>('command');
const pageLoading = ref(false);
const commandLoading = ref(false);
const sectionPanelRef = ref<(ComponentPublicInstance & { refreshData: () => Promise<void> }) | null>(null);

const {
  devices,
  selectedDeviceId,
  selectedDevice,
  loading: deviceLoading,
  fetchDevices
} = useDebugDeviceContext();

const {
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
const audioRecordState = ref<DebugAudioRecordState>(createInitialAudioRecordState());

watch(
  () => selectedDeviceId.value,
  async (deviceId) => {
    stopAllStreams();
    resetDeviceState();
    if (!deviceId) return;
    startEventStream(deviceId, (item) => {
      audioRecordState.value = reduceAudioRecordState(audioRecordState.value, item);
      if (item.eventName === 'audio.record.data' || item.eventName === 'audio.stt.result') {
        void loadAudioRecordState(deviceId);
      }
      deviceEvents.value = [item, ...deviceEvents.value].slice(0, 100);
    });
    startCommandStream(deviceId, upsertCommandRecord);
    await refreshActiveData();
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
  audioRecordState.value = createInitialAudioRecordState();
  selectedCommandDetail.value = null;
}

async function refreshActiveData() {
  if (!selectedDeviceId.value) return;
  pageLoading.value = true;
  try {
    if (activeTab.value === 'command') {
      await Promise.all([
        loadCommandData(),
        loadAudioRecordState(selectedDeviceId.value)
      ]);
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

async function loadAudioRecordState(deviceId: string) {
  try {
    const sessionResponse = await getDebugAudioRecordSession(deviceId);
    if (sessionResponse?.code === 20000) {
      audioRecordState.value = applyAudioRecordSession(
        audioRecordState.value,
        normalizeAudioRecordSession(sessionResponse)
      );
      return;
    }

    if (sessionResponse?.code && sessionResponse.code !== 40400) {
      throw new Error(sessionResponse.message || '加载录音会话失败');
    }

    audioRecordState.value = applyAudioRecordSession(audioRecordState.value, null);
    const artifactResponse = await getDebugAudioRecordArtifact(deviceId);

    if (artifactResponse?.code === 20000) {
      audioRecordState.value = applyAudioRecordArtifact(
        audioRecordState.value,
        normalizeAudioRecordArtifact(artifactResponse)
      );
      return;
    }

    if (artifactResponse?.code && artifactResponse.code !== 40400) {
      throw new Error(artifactResponse.message || '加载录音结果失败');
    }

    audioRecordState.value = applyAudioRecordArtifact(audioRecordState.value, null);
  } catch {
    ElMessage.error('加载音频采集状态失败');
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
    const current = next[index];
    next[index] = {
      ...current,
      ...item,
      action: item.action || current.action,
      phase: item.phase || current.phase,
      params: Object.keys(item.params).length ? item.params : current.params,
      dispatchStatus: item.dispatchStatus || current.dispatchStatus,
      ackStatus: item.ackStatus !== 'PENDING' || !current.ackStatus ? item.ackStatus : current.ackStatus,
      reason: item.reason || current.reason,
      createdAt: item.createdAt || current.createdAt,
      ackAt: item.ackAt || current.ackAt
    };
  } else {
    next.unshift({
      ...item,
      createdAt: item.createdAt || new Date().toISOString()
    });
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

.tabs-card {
  border-radius: 24px;
}

</style>
