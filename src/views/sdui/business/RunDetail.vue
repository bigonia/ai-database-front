<template>
  <div class="app-container run-detail">
    <header class="page-heading">
      <div>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="backLocation">{{ route.query.deviceId ? '终端详情' : '终端管理' }}</el-breadcrumb-item>
          <el-breadcrumb-item>运行详情</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>业务运行</h1>
        <p>{{ run?.runId || runId }} · <el-tag v-if="run" :type="runStatusType(run.status)">{{ runStatusLabel(run.status) }}</el-tag></p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" />
    <el-empty v-if="!loading && !error && !run" description="没有找到此运行记录" />
    <el-card v-if="run" v-loading="loading" shadow="never">
      <el-alert v-if="run.status === 'running'" class="running-callout" type="info" :closable="false" title="运行仍在进行，页面每 2 秒自动刷新；也可以手动刷新状态。" />
      <el-descriptions :column="2" border>
        <el-descriptions-item label="业务">{{ run.businessId }}</el-descriptions-item>
        <el-descriptions-item label="部署"><el-button link type="primary" @click="openDeployment">{{ run.deploymentId }}</el-button></el-descriptions-item>
        <el-descriptions-item label="设备">{{ run.deviceId }}</el-descriptions-item>
        <el-descriptions-item label="环节">{{ run.flowKey }}</el-descriptions-item>
        <el-descriptions-item label="触发来源">{{ run.triggerSource }}</el-descriptions-item>
        <el-descriptions-item label="调用 ID">{{ run.invocationId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开始">{{ formatTime(run.startedAt) }}</el-descriptions-item>
        <el-descriptions-item label="结束">{{ formatTime(run.completedAt) }}</el-descriptions-item>
        <el-descriptions-item label="停止步骤">{{ stoppedAtStepLabel }}</el-descriptions-item>
        <el-descriptions-item label="错误">{{ run.error || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="run.status === 'failed'" class="failure-callout" type="error" :closable="false" :title="failureTitle">
        <template #default><span>{{ run.error || '该步骤执行失败，请查看步骤摘要。' }}</span></template>
      </el-alert>
      <h3>步骤结果</h3>
      <el-table :data="run.stepSummaries || []" empty-text="没有步骤摘要" :row-class-name="stepRowClassName">
        <el-table-column label="步骤" width="90"><template #default="{ row }">第 {{ row.index + 1 }} 步</template></el-table-column>
        <el-table-column prop="action" label="动作" min-width="180" />
        <el-table-column label="执行位置" width="130"><template #default="{ row }">{{ row.target || '未发送到设备' }}</template></el-table-column>
        <el-table-column label="结果" width="120"><template #default="{ row }"><el-tag :type="runStatusType(row.status)">{{ runStatusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column prop="error" label="错误" min-width="220" />
        <el-table-column label="详情" min-width="240"><template #default="{ row }"><pre>{{ JSON.stringify(row.detail, null, 2) }}</pre></template></el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getBusinessRun } from '@/api/sdui-runs';
import { parseBusinessRun } from '@/sdui/businessRuns';
import type { BusinessRun } from '@/types/sdui-run';
import { runStatusLabel, runStatusType } from '@/sdui/businessStatus';
import { createRunPolling } from '@/sdui/runPolling';
import { errorDetails } from '@/utils/errorDetails';

const route = useRoute();
const router = useRouter();
const runId = computed(() => String(route.params.runId || ''));
const contextDeviceId = computed(() => typeof route.query.deviceId === 'string' ? route.query.deviceId : '');
const backLocation = computed(() => contextDeviceId.value
  ? { name: 'SduiTerminalDetail', params: { deviceId: contextDeviceId.value }}
  : { name: 'SduiTerminal' });
const run = ref<BusinessRun | null>(null);
const triggerRejectedBeforeSteps = computed(() => run.value?.status === 'failed' &&
  run.value.stoppedAtAction === 'business.trigger' &&
  !run.value.stepSummaries.some((summary) => summary.index === run.value?.stoppedAtIndex));
const stoppedAtStepLabel = computed(() => {
  const current = run.value;
  if (triggerRejectedBeforeSteps.value) return '外部触发未进入业务步骤';
  if (!current || current.stoppedAtIndex == null) return '-';
  const action = current.stoppedAtAction ||
    current.stepSummaries.find((summary) => summary.index === current.stoppedAtIndex)?.action;
  return `第 ${current.stoppedAtIndex + 1} 步${action ? `：${action}` : ''}`;
});
const failureTitle = computed(() => {
  const current = run.value;
  if (triggerRejectedBeforeSteps.value) return '外部触发未受理，业务步骤尚未开始';
  if (!current || current.stoppedAtIndex == null) return '步骤执行前失败';
  return `运行在 ${stoppedAtStepLabel.value} 停止`;
});
const loading = ref(false);
const error = ref('');
let requestGeneration = 0;
let pageActive = true;
const polling = createRunPolling({
  isActive: () => pageActive,
  getRunId: () => runId.value,
  getGeneration: () => requestGeneration,
  isRunning: () => run.value?.status === 'running',
  load: () => { void load(); },
  setTimer: (callback, delay) => window.setTimeout(callback, delay),
  clearTimer: timer => window.clearTimeout(timer)
});
const clearPollTimer = polling.clear;
const schedulePoll = polling.schedule;

async function load() {
  const requestedRunId = runId.value;
  const requestedDeviceId = contextDeviceId.value;
  if (!pageActive || !requestedRunId) return;
  clearPollTimer();
  const requestId = ++requestGeneration;
  loading.value = true;
  error.value = '';
  try {
    const response = await getBusinessRun(requestedRunId) as { data?: unknown };
    if (requestId !== requestGeneration || requestedRunId !== runId.value) return;
    run.value = parseBusinessRun(response?.data, requestedRunId, requestedDeviceId || undefined);
  } catch (cause: unknown) {
    if (requestId === requestGeneration && requestedRunId === runId.value) {
      const reason = errorDetails(cause).message || '运行详情读取失败';
      const details = errorDetails(cause);
      const status = details.response?.status;
      const code = details.code ?? details.apiResponse?.code;
      if (status === 401 || status === 403 || status === 404 || code === 40400) {
        run.value = null;
        error.value = reason;
      } else {
        error.value = run.value ? `刷新失败，下面保留上次读取的运行详情供参考：${reason}` : reason;
      }
    }
  } finally {
    if (requestId === requestGeneration) {
      loading.value = false;
      schedulePoll(requestedRunId, requestId);
    }
  }
}

function stepRowClassName({ row }: { row: BusinessRun['stepSummaries'][number] }) {
  return row.status === 'failed' || row.index === run.value?.stoppedAtIndex ? 'failed-step-row' : '';
}

function openDeployment() {
  if (!run.value?.deploymentId) return;
  void router.push({ name: 'SduiDeploymentDetail', params: { deploymentId: run.value.deploymentId }});
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

watch([runId, contextDeviceId], () => {
  if (!pageActive) return;
  clearPollTimer();
  run.value = null;
  error.value = '';
  requestGeneration++;
  void load();
}, { immediate: true });

onBeforeUnmount(() => {
  pageActive = false;
  clearPollTimer();
  requestGeneration++;
  loading.value = false;
});

onDeactivated(() => {
  pageActive = false;
  clearPollTimer();
  requestGeneration++;
  loading.value = false;
});

onActivated(() => {
  if (pageActive) return;
  pageActive = true;
  void load();
});
</script>

<style scoped>
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.page-heading h1 { margin: 12px 0 4px; font-size: 24px; }
.page-heading p { display: flex; align-items: center; gap: 8px; margin: 0; color: #667085; }
.failure-callout { margin-top: 18px; }
.running-callout { margin-bottom: 16px; }
h3 { margin-top: 26px; }
pre { max-width: 600px; max-height: 220px; overflow: auto; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; }
:deep(.failed-step-row > td) { background: #fff1f0 !important; }
</style>
