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
            <span>连接 {{ detail.connectionCount ?? 0 }} 次</span>
          </div>
        </div>
        <div class="topbar-actions">
          <el-button size="small" @click="router.push({ name: 'SduiDeployments' })">部署记录</el-button>
          <el-button size="small" @click="router.push({ name: 'SduiDebug', query: { deviceId: detail.deviceId } })">
            打开调试台
          </el-button>
        </div>
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
          <RuntimeStatusPanel
            :status="runtimeStatus"
            :loading="runtimeStatusLoading"
            :error="runtimeStatusError"
            @refresh="loadRuntimeStatus"
          />
          <div class="card-slot slot-trends">
            <TelemetryTrends
              :trend-data="trendData"
              :range="trendRange"
              :metrics="trendMetrics"
              :loading="telemetryLoading.trends"
              :error="telemetryErrors.trends"
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
                :loading="connLoading"
                :error="connectionError"
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
            :error="telemetryErrors.table"
            :total="telemetryPagination.total"
            :current-page="telemetryPagination.page"
            :page-size="telemetryPagination.size"
            @page-change="onTelemetryPageChange"
          />
        </div>
        <div class="card-slot slot-commands"><section class="runs-card"><header><div><h3>业务运行记录</h3><p>来自平台持久化的业务执行摘要 · 当前数据为最近 {{ runsLoadedLimit || runsLimit }} 条以内<span v-if="runsLoading && runsLoadedLimit && runsLoadedLimit !== runsLimit">（正在读取最近 {{ runsLimit }} 条）</span></p></div><div class="run-controls"><el-select v-model="runsLimit" size="small" class="runs-limit" aria-label="读取最近运行记录条数" @change="loadRuns"><el-option v-for="limit in runLimits" :key="limit" :label="`最近 ${limit} 条`" :value="limit"/></el-select><el-select v-model="runStatusFilter" size="small" class="runs-filter" aria-label="按运行结果筛选"><el-option label="全部结果" value="all"/><el-option label="成功" value="passed"/><el-option label="失败" value="failed"/><el-option label="运行中" value="running"/></el-select><el-button size="small" :loading="runsLoading" @click="loadRuns">刷新</el-button></div></header><el-alert v-if="runsError" :type="runs.length ? 'warning' : 'error'" :closable="false" :title="runsError"/><el-table v-loading="runsLoading" :data="filteredRuns" size="small" :empty-text="runsError ? (runs.length ? '上次读取的记录中没有此结果' : '读取失败') : runs.length && runStatusFilter !== 'all' ? '最近记录中没有此结果' : '暂无运行记录'"><el-table-column type="expand"><template #default="{ row }"><div class="run-step-summary"><div class="run-step-heading">{{ row.flowKey || '业务执行' }} · {{ row.stepSummaries.length }} 个执行环节</div><el-table :data="row.stepSummaries" size="small" empty-text="该记录没有步骤摘要"><el-table-column label="环节" min-width="180"><template #default="{ row: step }">{{ step.index + 1 }}. {{ step.action }}</template></el-table-column><el-table-column prop="target" label="执行设备" min-width="150"/><el-table-column label="结果" width="90"><template #default="{ row: step }"><el-tag :type="step.status === 'ok' ? 'success' : 'danger'">{{ step.status === 'ok' ? '成功' : '失败' }}</el-tag></template></el-table-column><el-table-column label="过程摘要" min-width="220"><template #default="{ row: step }">{{ step.error || step.detail?.result || step.detail?.execution || '已完成' }}</template></el-table-column></el-table></div></template></el-table-column><el-table-column label="时间" min-width="150"><template #default="{ row }">{{ formatRunTime(row.startedAt) }}</template></el-table-column><el-table-column prop="businessId" label="业务" min-width="120"/><el-table-column prop="flowKey" label="业务环节" min-width="110"/><el-table-column prop="triggerSource" label="触发来源" min-width="130"/><el-table-column label="停止步骤" min-width="150"><template #default="{ row }">{{ runStoppedStepLabel(row) }}</template></el-table-column><el-table-column label="结果" width="100"><template #default="{ row }"><el-tag :type="runStatusType(row.status)">{{ runStatusLabel(row.status) }}</el-tag></template></el-table-column><el-table-column label="错误摘要" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.error || row.stepSummaries.find((step) => step.status === 'failed')?.error || '-' }}</template></el-table-column><el-table-column label="详情" width="90"><template #default="{ row }"><el-button link type="primary" @click="router.push({ name: 'SduiRunDetail', params: { runId: row.runId }, query: { deviceId: detail!.deviceId } })">详情</el-button></template></el-table-column></el-table></section></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

import DeviceInfoPanel from './components/DeviceInfoPanel.vue';
import TelemetrySnapshot from './components/TelemetrySnapshot.vue';
import TelemetryTrends from './components/TelemetryTrends.vue';
import TelemetryTable from './components/TelemetryTable.vue';
import ConnectionTimeline from './components/ConnectionTimeline.vue';
import RuntimeStatusPanel from './components/RuntimeStatusPanel.vue';

import { useDeviceDetail } from './composables/useDeviceDetail';
import { useTelemetry } from './composables/useTelemetry';
import { useConnectionLog } from './composables/useConnectionLog';
import { getDeviceRuns, parseRecentBusinessRuns } from '@/api/business';
import type { BusinessRun, RecentBusinessRuns } from '@/api/business';
import { getTerminalRuntimeStatus, parseTerminalRuntimeStatus } from '@/api/terminal-runtime';
import type { TerminalRuntimeStatus } from '@/api/terminal-runtime';

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
  errors: telemetryErrors,
  fetchTelemetryHistory,
  fetchTelemetryTrends,
  setTrendRange,
  setTrendMetrics,
  handleTelemetryPage,
  reset: resetTelemetry
} = useTelemetry();

const {
  connectionData,
  connectionPagination,
  loading: connLoading,
  error: connectionError,
  fetchConnectionLog,
  handleConnectionPage,
  reset: resetConnectionLog
} = useConnectionLog();

const deviceId = ref((route.params.deviceId as string) || '');
const runs = ref<BusinessRun[]>([]);
const runLimits = [20, 50, 100, 200];
const runsLimit = ref(20);
const runsLoadedLimit = ref(0);
const runStatusFilter = ref<'all' | 'passed' | 'failed' | 'running'>('all');
const filteredRuns = computed(() => runStatusFilter.value === 'all'
  ? runs.value
  : runs.value.filter((run) => run.status === runStatusFilter.value));
const runsLoading = ref(false);
const runsError = ref('');
const runtimeStatus = ref<TerminalRuntimeStatus | null>(null);
const runtimeStatusLoading = ref(false);
const runtimeStatusError = ref('');
let runtimeStatusRequestId = 0;
let runsRequestId = 0;
function applyRuntimeStatus(status: TerminalRuntimeStatus) {
  runtimeStatus.value = status;
}

async function loadRuntimeStatus() {
  if (!deviceId.value) return;
  const requestedDeviceId = deviceId.value;
  const requestId = ++runtimeStatusRequestId;
  runtimeStatusLoading.value = true;
  runtimeStatusError.value = '';
  try {
    const response = await getTerminalRuntimeStatus(requestedDeviceId);
    if (requestedDeviceId !== deviceId.value || requestId !== runtimeStatusRequestId) return;
    applyRuntimeStatus(parseTerminalRuntimeStatus(response?.data, requestedDeviceId));
  } catch (error: any) {
    if (requestedDeviceId === deviceId.value && requestId === runtimeStatusRequestId) {
      runtimeStatusError.value = runtimeStatus.value
        ? `刷新失败，当前显示上次读取的状态：${error.message || '请求失败'}`
        : error.message || '终端运行状态读取失败';
    }
  } finally {
    if (requestedDeviceId === deviceId.value && requestId === runtimeStatusRequestId) runtimeStatusLoading.value = false;
  }
}

async function loadRuns() {
  if (!deviceId.value) return;
  const requestedDeviceId = deviceId.value;
  const requestedLimit = runsLimit.value;
  const requestId = ++runsRequestId;
  const isCurrentRequest = () => requestedDeviceId === deviceId.value
    && requestedLimit === runsLimit.value && requestId === runsRequestId;
  runsLoading.value = true;
  runsError.value = '';
  try {
    const response: any = await getDeviceRuns(requestedDeviceId, requestedLimit);
    if (!isCurrentRequest()) return;
    const data = response?.data;
    runs.value = parseRecentBusinessRuns(data, requestedDeviceId).runs;
    runsLoadedLimit.value = requestedLimit;
  } catch (cause: any) {
    if (isCurrentRequest()) {
      const reason = cause.message || '运行记录读取失败';
      if (runs.value.length && runsLoadedLimit.value && runsLoadedLimit.value !== requestedLimit) {
        runsError.value = `最近 ${requestedLimit} 条运行记录读取失败，当前仍显示最近 ${runsLoadedLimit.value} 条请求的上次成功快照：${reason}`;
      } else {
        runsError.value = runs.value.length
          ? `刷新失败，下面保留上次读取的运行记录供参考：${reason}`
          : reason;
      }
    }
  } finally {
    if (isCurrentRequest()) runsLoading.value = false;
  }
}

function runStatusType(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'passed') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function runStatusLabel(status: string): string {
  return ({ passed: '成功', failed: '失败', running: '运行中' } as Record<string, string>)[status] || status || '未知';
}

function runStoppedStepLabel(run: BusinessRun): string {
  if (run.status === 'failed' && run.stoppedAtIndex == null) return '步骤执行前失败';
  if (run.stoppedAtIndex == null) return '-';
  const action = run.stoppedAtAction
    || run.stepSummaries.find((step) => step.index === run.stoppedAtIndex)?.action;
  return `第 ${run.stoppedAtIndex + 1} 步${action ? `：${action}` : ''}`;
}

function formatRunTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function init() {
  runtimeStatusRequestId++;
  runsRequestId++;
  if (!deviceId.value) return;
  clearDetail();
  resetTelemetry();
  resetConnectionLog();
  runs.value = [];
  runsLoadedLimit.value = 0;
  runsError.value = '';
  runtimeStatus.value = null;
  runtimeStatusError.value = '';
  runtimeStatusLoading.value = false;
  fetchDetail(deviceId.value);
  fetchTelemetryTrends(deviceId.value);
  fetchTelemetryHistory(deviceId.value);
  fetchConnectionLog(deviceId.value);
  loadRuns();
  loadRuntimeStatus();
}

onBeforeUnmount(() => { runtimeStatusRequestId++; runsRequestId++; clearDetail(); });
onMounted(init);
onActivated(() => {
  if (!detail.value) return;
  loadRuntimeStatus();
});

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
.runs-card { padding:16px; background:#fff; border-radius:8px; }.runs-card header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }.runs-card h3 { margin:0 0 4px; }.runs-card p { margin:0; color:#667085; font-size:12px; }.run-controls { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.runs-limit { width:130px; }.runs-filter { width:110px; }.run-step-summary { padding:14px 18px; background:#f8fafc; }.run-step-heading { margin-bottom:10px; color:#475467; font-weight:600; }

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
.topbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.breadcrumb { font-size: 12px; }
.topbar-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.topbar-title-row h2 { margin: 0; font-size: 18px; line-height: 1.3; }
.topbar-id { font-family: Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #64748b; }
.topbar-sep { color: #d1d5db; }

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

.slot-info { height: auto; }

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
  .slot-snapshot,
  .slot-trends,
  .slot-connection,
  .slot-history,
  .slot-commands {
    height: auto;
    min-height: 320px;
  }

  .slot-info { height: auto; min-height: 0; }

  .slot-trends {
    min-height: 420px;
  }
}
</style>
