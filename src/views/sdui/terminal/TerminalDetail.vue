<template>
  <main class="app-container terminal-detail-page">
    <header class="page-heading" v-loading="loading.detail">
      <template v-if="detail">
        <div class="heading-main">
          <el-button class="back-link" link @click="router.push({ name: 'SduiTerminal' })">← 终端管理</el-button>
          <div class="title-row">
            <h1>{{ detail.name || '未命名终端' }}</h1>
            <el-tag :type="detail.status === 'ONLINE' ? 'success' : 'info'" size="small">
              {{ detail.status === 'ONLINE' ? '在线' : '离线' }}
            </el-tag>
            <code>{{ detail.deviceId }}</code>
          </div>
        </div>
        <div class="heading-actions">
          <el-button :icon="Refresh" :loading="isRefreshing" @click="refreshDetail">刷新</el-button>
          <el-button type="primary" @click="router.push({ name: 'SduiDebug', query: { deviceId: detail.deviceId } })">打开调试台</el-button>
        </div>
      </template>
      <div v-else-if="!loading.detail" class="not-found">
        <el-empty description="设备不存在或加载失败">
          <el-button type="primary" @click="router.push({ name: 'SduiTerminal' })">返回终端列表</el-button>
        </el-empty>
      </div>
    </header>

    <el-tabs v-if="detail" v-model="activeSection" class="detail-tabs">
      <el-tab-pane label="运行概览" name="overview">
        <RuntimeStatusPanel
          :status="runtimeStatus"
          :loading="runtimeStatusLoading"
          :error="runtimeStatusError"
          @refresh="loadRuntimeStatus"
        />
      </el-tab-pane>
      <el-tab-pane label="设备信息" name="info">
        <DeviceInfoPanel
          :detail="detail"
          :saving="loading.saving"
          @save="(data) => saveDeviceInfo(detail!.deviceId, data)"
        />
      </el-tab-pane>
      <el-tab-pane label="遥测" name="telemetry">
        <div class="telemetry-overview">
          <TelemetrySnapshot :telemetry="detail.lastTelemetry" :total-uptime-s="detail.totalUptimeS" />
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
        <TelemetryTable
          :rows="telemetryRows"
          :loading="telemetryLoading.table"
          :error="telemetryErrors.table"
          :total="telemetryPagination.total"
          :current-page="telemetryPagination.page"
          :page-size="telemetryPagination.size"
          @page-change="onTelemetryPageChange"
        />
      </el-tab-pane>
      <el-tab-pane label="连接历史" name="connections">
        <ConnectionTimeline
          :data="connectionData"
          :current-page="connectionPagination.page"
          :page-size="connectionPagination.size"
          :loading="connLoading"
          :error="connectionError"
          @page-change="onConnectionPageChange"
        />
      </el-tab-pane>
      <el-tab-pane label="业务运行" name="runs">
        <section class="runs-section">
          <header class="section-heading">
            <div>
              <h2>业务运行记录</h2>
              <p>显示最近 {{ runsLoadedLimit || runsLimit }} 条内的执行记录<span v-if="runsLoading && runsLoadedLimit && runsLoadedLimit !== runsLimit">，正在读取最近 {{ runsLimit }} 条</span></p>
            </div>
            <div class="run-controls">
              <el-select v-model="runsLimit" class="runs-limit" aria-label="读取最近运行记录条数" @change="loadRuns">
                <el-option v-for="limit in runLimits" :key="limit" :label="`最近 ${limit} 条`" :value="limit" />
              </el-select>
              <el-select v-model="runStatusFilter" class="runs-filter" aria-label="按运行结果筛选">
                <el-option label="全部结果" value="all" />
                <el-option label="成功" value="passed" />
                <el-option label="失败" value="failed" />
                <el-option label="运行中" value="running" />
              </el-select>
              <el-button :loading="runsLoading" @click="loadRuns">刷新</el-button>
            </div>
          </header>
          <el-alert v-if="runsError" :type="runs.length ? 'warning' : 'error'" :closable="false" :title="runsError" />
          <el-table
            v-loading="runsLoading"
            :data="filteredRuns"
            :empty-text="runsError ? (runs.length ? '上次读取的记录中没有此结果' : '读取失败') : runs.length && runStatusFilter !== 'all' ? '最近记录中没有此结果' : '暂无运行记录'"
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="run-step-summary">
                  <div class="run-step-heading">{{ row.flowKey || '业务执行' }} · {{ row.stepSummaries.length }} 个执行步骤</div>
                  <el-table :data="row.stepSummaries" size="small" empty-text="该记录没有步骤摘要">
                    <el-table-column label="步骤" min-width="180"><template #default="{ row: step }">{{ step.index + 1 }}. {{ step.action }}</template></el-table-column>
                    <el-table-column prop="target" label="执行设备" min-width="150" />
                    <el-table-column label="结果" width="90"><template #default="{ row: step }"><el-tag :type="step.status === 'ok' ? 'success' : 'danger'">{{ step.status === 'ok' ? '成功' : '失败' }}</el-tag></template></el-table-column>
                    <el-table-column label="过程摘要" min-width="220"><template #default="{ row: step }">{{ step.error || step.detail?.result || step.detail?.execution || '已完成' }}</template></el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="时间" min-width="160"><template #default="{ row }">{{ formatRunTime(row.startedAt) }}</template></el-table-column>
            <el-table-column prop="businessId" label="业务 ID" min-width="140" />
            <el-table-column prop="flowKey" label="业务环节" min-width="120" />
            <el-table-column prop="triggerSource" label="触发来源" min-width="130" />
            <el-table-column label="停止步骤" min-width="150"><template #default="{ row }">{{ runStoppedStepLabel(row) }}</template></el-table-column>
            <el-table-column label="结果" width="100"><template #default="{ row }"><el-tag :type="runStatusType(row.status)">{{ runStatusLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="错误摘要" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.error || row.stepSummaries.find((step) => step.status === 'failed')?.error || '—' }}</template></el-table-column>
            <el-table-column label="详情" width="90"><template #default="{ row }"><el-button link type="primary" @click="router.push({ name: 'SduiRunDetail', params: { runId: row.runId }, query: { deviceId: detail!.deviceId } })">详情</el-button></template></el-table-column>
          </el-table>
        </section>
      </el-tab-pane>
    </el-tabs>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted, onActivated, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Refresh } from '@element-plus/icons-vue';
import { errorDetails } from '@/utils/errorDetails';

import DeviceInfoPanel from './components/DeviceInfoPanel.vue';
import TelemetrySnapshot from './components/TelemetrySnapshot.vue';
import TelemetryTrends from './components/TelemetryTrends.vue';
import TelemetryTable from './components/TelemetryTable.vue';
import ConnectionTimeline from './components/ConnectionTimeline.vue';
import RuntimeStatusPanel from './components/RuntimeStatusPanel.vue';

import { useDeviceDetail } from './composables/useDeviceDetail';
import { useTelemetry } from './composables/useTelemetry';
import { useConnectionLog } from './composables/useConnectionLog';
import { getDeviceRuns } from '@/api/sdui-runs';
import { parseRecentBusinessRuns } from '@/sdui/businessRuns';
import type { BusinessRun } from '@/types/sdui-run';
import { getTerminalRuntimeStatus } from '@/api/terminal-runtime';
import { createTerminalRuntimeLoader, parseTerminalRuntimeStatus, type TerminalRuntimeStatus } from '@/sdui/terminalRuntime';

const route = useRoute();
const router = useRouter();
const detailSections = ['overview', 'info', 'telemetry', 'connections', 'runs'] as const;
function sectionFromQuery(value: unknown) {
  return typeof value === 'string' && detailSections.includes(value as typeof detailSections[number]) ? value : 'overview';
}
const activeSection = ref(sectionFromQuery(route.query.section));
watch(() => route.query.section, value => {
  const section = sectionFromQuery(value);
  if (activeSection.value !== section) activeSection.value = section;
});
watch(activeSection, section => {
  const querySection = section === 'overview' ? undefined : section;
  if (route.query.section === querySection) return;
  void router.replace({ query: { ...route.query, section: querySection }});
});

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
const isRefreshing = computed(() => loading.detail || runtimeStatusLoading.value || runsLoading.value ||
  telemetryLoading.trends || telemetryLoading.table || connLoading.value);
let runsRequestId = 0;
const runtimeStatusLoader = createTerminalRuntimeLoader<TerminalRuntimeStatus>({
  getDeviceId: () => deviceId.value,
  getCurrent: () => runtimeStatus.value,
  read: async requestedDeviceId => (await getTerminalRuntimeStatus(requestedDeviceId))?.data,
  parse: parseTerminalRuntimeStatus,
  setValue: value => { runtimeStatus.value = value; },
  setLoading: value => { runtimeStatusLoading.value = value; },
  setError: value => { runtimeStatusError.value = value; },
  message: cause => errorDetails(cause).message || ''
});
const loadRuntimeStatus = runtimeStatusLoader.load;

async function loadRuns() {
  if (!deviceId.value) return;
  const requestedDeviceId = deviceId.value;
  const requestedLimit = runsLimit.value;
  const requestId = ++runsRequestId;
  const isCurrentRequest = () => requestedDeviceId === deviceId.value &&
    requestedLimit === runsLimit.value && requestId === runsRequestId;
  runsLoading.value = true;
  runsError.value = '';
  try {
    const response: unknown = await getDeviceRuns(requestedDeviceId, requestedLimit);
    if (!isCurrentRequest()) return;
    const data = response !== null && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, unknown>).data
      : undefined;
    runs.value = parseRecentBusinessRuns(data, requestedDeviceId).runs;
    runsLoadedLimit.value = requestedLimit;
  } catch (cause: unknown) {
    if (isCurrentRequest()) {
      const reason = errorDetails(cause).message || '运行记录读取失败';
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

function refreshDetail() {
  if (!deviceId.value) return;
  const requestedDeviceId = deviceId.value;
  void fetchDetail(requestedDeviceId);
  void fetchTelemetryTrends(requestedDeviceId);
  void fetchTelemetryHistory(requestedDeviceId);
  void fetchConnectionLog(requestedDeviceId);
  void loadRuns();
  void loadRuntimeStatus();
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
  const action = run.stoppedAtAction ||
    run.stepSummaries.find((step) => step.index === run.stoppedAtIndex)?.action;
  return `第 ${run.stoppedAtIndex + 1} 步${action ? `：${action}` : ''}`;
}

function formatRunTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function init() {
  runtimeStatusLoader.invalidate();
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

onBeforeUnmount(() => { runtimeStatusLoader.invalidate(); runsRequestId++; clearDetail(); });
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
.terminal-detail-page { --el-color-primary:var(--app-primary); --el-color-primary-light-9:var(--app-primary-soft); --el-text-color-primary:var(--app-text); --el-text-color-regular:var(--app-text-secondary); --el-border-color:var(--app-border); display:flex; flex-direction:column; gap:16px; padding:24px; color:var(--app-text); }
.page-heading,.heading-main,.heading-actions,.title-row,.section-heading,.run-controls { display:flex; align-items:center; }
.page-heading,.section-heading { justify-content:space-between; gap:16px; }
.heading-main { align-items:flex-start; flex-direction:column; gap:4px; min-width:0; }
.back-link { height:auto; padding:0; color:var(--app-text-secondary); }
.title-row { flex-wrap:wrap; gap:10px; }
.title-row h1 { margin:0; font-size:22px; line-height:30px; font-weight:600; }
.title-row code { color:var(--app-text-muted); font-size:12px; overflow-wrap:anywhere; }
.heading-actions,.run-controls { flex-wrap:wrap; gap:8px; }
.detail-tabs { min-width:0; }
.detail-tabs :deep(.el-tab-pane) { min-width:0; }
.telemetry-overview { display:grid; grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr); gap:16px; align-items:start; margin-bottom:16px; }
.runs-section { min-width:0; }
.section-heading { flex-wrap:wrap; margin-bottom:16px; }
.section-heading h2 { margin:0 0 4px; font-size:16px; line-height:24px; }
.section-heading p { margin:0; color:var(--app-text-muted); font-size:13px; line-height:20px; }
.runs-limit { width:140px; }
.runs-filter { width:120px; }
.run-step-summary { padding:12px 16px; background:var(--app-surface-muted); }
.run-step-heading { margin-bottom:10px; color:var(--app-text-secondary); font-weight:600; }
.not-found { padding:24px 0; }
.runs-section > .el-alert { margin-bottom:12px; }
@media (max-width:900px) { .telemetry-overview { grid-template-columns:1fr; } }
@media (max-width:700px) {
  .terminal-detail-page { padding:16px; }
  .page-heading { align-items:flex-start; flex-direction:column; }
  .heading-actions { width:100%; }
  .heading-actions .el-button { flex:1; }
  .section-heading { align-items:flex-start; flex-direction:column; }
  .run-controls { width:100%; }
  .run-controls :deep(.el-select) { flex:1; min-width:120px; }
}
</style>
