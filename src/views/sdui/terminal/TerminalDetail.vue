<template>
  <div class="app-container terminal-detail-page">
    <!-- ═══ Compact Topbar ═══ -->
    <div class="detail-topbar" v-loading="loading.detail">
      <template v-if="detail">
        <div class="topbar-left">
          <el-breadcrumb class="breadcrumb">
            <el-breadcrumb-item :to="{ name: 'SduiTerminal' }">终端管理</el-breadcrumb-item>
            <el-breadcrumb-item>{{ detail.name || detail.deviceId }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="topbar-title-row">
            <h2>{{ detail.name || detail.deviceId }}</h2>
            <el-tag :type="detail.status === 'ONLINE' ? 'success' : 'info'" size="small" effect="dark" round>
              {{ detail.status === 'ONLINE' ? '在线' : '离线' }}
            </el-tag>
            <span class="topbar-id">{{ detail.deviceId }}</span>
            <span class="topbar-sep">·</span>
            <span class="topbar-board">{{ detail.board || '-' }}</span>
            <span class="topbar-sep">·</span>
            <span>连接 {{ detail.connectionCount ?? 0 }} 次</span>
          </div>
        </div>
        <el-button size="small">编辑</el-button>
      </template>
      <div v-else-if="!loading.detail" class="not-found">
        <el-empty description="设备不存在或加载失败" :image-size="60">
          <el-button type="primary" @click="router.push({ name: 'SduiTerminal' })">返回列表</el-button>
        </el-empty>
      </div>
    </div>

    <template v-if="detail">
      <div class="overview-grid">
        <div class="overview-left">
          <div class="card-slot slot-info">
            <DeviceInfoPanel
              :detail="detail"
              :saving="loading.saving"
              @save="(data) => saveDeviceInfo(detail!.deviceId, data)"
            />
          </div>
          <div class="card-slot slot-trends">
            <TelemetryTrends
              :trend-data="trendData"
              :range="trendRange"
              :metrics="trendMetrics"
              :loading="telemetryLoading.trends"
              @update:range="onRangeChange"
              @update:metrics="onMetricsChange"
            />
          </div>
        </div>
        <div class="overview-right">
          <div class="card-slot slot-snapshot">
            <TelemetrySnapshot
              :telemetry="detail.lastTelemetry"
              :total-uptime-s="detail.totalUptimeS"
            />
          </div>
          <div class="card-slot slot-connection">
            <div v-loading="connLoading">
              <ConnectionTimeline
                :data="connectionData"
                :current-page="connectionPagination.page"
                :page-size="connectionPagination.size"
                @page-change="onConnectionPageChange"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-grid">
        <div class="card-slot slot-history">
          <TelemetryTable
            :rows="telemetryRows"
            :loading="telemetryLoading.table"
            :total="telemetryPagination.total"
            :current-page="telemetryPagination.page"
            :page-size="telemetryPagination.size"
            @page-change="onTelemetryPageChange"
          />
        </div>
        <div class="card-slot slot-commands">
          <RecentCommands :commands="detail.recentCommands || []" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import DeviceInfoPanel from './components/DeviceInfoPanel.vue';
import TelemetrySnapshot from './components/TelemetrySnapshot.vue';
import RecentCommands from './components/RecentCommands.vue';
import TelemetryTrends from './components/TelemetryTrends.vue';
import TelemetryTable from './components/TelemetryTable.vue';
import ConnectionTimeline from './components/ConnectionTimeline.vue';

import { useDeviceDetail } from './composables/useDeviceDetail';
import { useTelemetry } from './composables/useTelemetry';
import { useConnectionLog } from './composables/useConnectionLog';

const route = useRoute();
const router = useRouter();

const { detail, loading, fetchDetail, saveDeviceInfo, clearDetail } = useDeviceDetail();

const {
  telemetryRows,
  telemetryPagination,
  trendData,
  trendRange,
  trendMetrics,
  loading: telemetryLoading,
  fetchTelemetryHistory,
  fetchTelemetryTrends,
  setTrendRange,
  setTrendMetrics,
  handleTelemetryPage
} = useTelemetry();

const {
  connectionData,
  connectionPagination,
  loading: connLoading,
  fetchConnectionLog,
  handleConnectionPage
} = useConnectionLog();

const deviceId = ref((route.params.deviceId as string) || '');

function init() {
  deviceId.value = (route.params.deviceId as string) || '';
  if (!deviceId.value) return;
  clearDetail();
  fetchDetail(deviceId.value);
  fetchTelemetryTrends(deviceId.value);
  fetchTelemetryHistory(deviceId.value);
  fetchConnectionLog(deviceId.value);
}

onBeforeUnmount(() => { clearDetail(); });
watch(() => route.params.deviceId, () => { init(); }, { immediate: true });

function onRangeChange(range: string) {
  setTrendRange(range);
  if (deviceId.value) fetchTelemetryTrends(deviceId.value);
}
function onMetricsChange(metrics: string) {
  setTrendMetrics(metrics);
  if (deviceId.value) fetchTelemetryTrends(deviceId.value);
}
function onTelemetryPageChange(page: number, size: number) {
  handleTelemetryPage(page, size);
  if (deviceId.value) fetchTelemetryHistory(deviceId.value);
}
function onConnectionPageChange(page: number, size: number) {
  handleConnectionPage(page, size);
  if (deviceId.value) fetchConnectionLog(deviceId.value);
}
</script>

<style scoped>
.terminal-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Topbar ─────────────────────────── */
.detail-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;
}
.topbar-left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.breadcrumb { font-size: 12px; }
.topbar-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.topbar-title-row h2 { margin: 0; font-size: 18px; line-height: 1.3; }
.topbar-id { font-family: Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #64748b; }
.topbar-sep { color: #d1d5db; }
.topbar-board { font-size: 12px; color: #6b7280; }

/* ── Overview grid ──────────────────── */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
.overview-left,
.overview-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* ── Bottom grid ────────────────────── */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.card-slot {
  min-width: 0;
}

.slot-info,
.slot-snapshot {
  height: 260px;
}

.slot-trends,
.slot-connection,
.slot-history,
.slot-commands {
  height: 380px;
}

.slot-trends {
  height: auto;
  min-height: 420px;
}

.card-slot > :deep(*) {
  height: 100%;
}

.slot-connection > div {
  height: 100%;
}

.not-found { padding: 40px 0; }

@media (max-width: 1200px) {
  .overview-grid, .bottom-grid { grid-template-columns: 1fr; }
  .slot-info,
  .slot-snapshot,
  .slot-trends,
  .slot-connection,
  .slot-history,
  .slot-commands {
    height: auto;
    min-height: 320px;
  }

  .slot-trends {
    min-height: 420px;
  }
}
</style>
