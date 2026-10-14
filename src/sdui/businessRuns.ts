import type { BusinessRun, RecentBusinessRuns } from '@/types/sdui-run';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseBusinessRun(value: unknown, expectedRunId?: string, expectedDeviceId?: string): BusinessRun {
  if (!isRecord(value) || typeof value.runId !== 'string' || !value.runId ||
    (expectedRunId !== undefined && value.runId !== expectedRunId) ||
    typeof value.businessId !== 'string' || !value.businessId ||
    typeof value.deploymentId !== 'string' || !value.deploymentId ||
    typeof value.deviceId !== 'string' || !value.deviceId ||
    (expectedDeviceId !== undefined && value.deviceId !== expectedDeviceId) ||
    typeof value.flowKey !== 'string' || !value.flowKey ||
    typeof value.triggerSource !== 'string' || !value.triggerSource ||
    typeof value.invocationId !== 'string' || !value.invocationId ||
    !['passed', 'failed', 'running'].includes(String(value.status)) ||
    !(value.stoppedAtIndex === null || (Number.isInteger(value.stoppedAtIndex) && Number(value.stoppedAtIndex) >= 0)) ||
    !(value.stoppedAtAction === null || typeof value.stoppedAtAction === 'string') ||
    !(value.error === null || typeof value.error === 'string') ||
    !Array.isArray(value.stepSummaries) ||
    !(value.startedAt === null || typeof value.startedAt === 'string') ||
    !(value.completedAt === null || typeof value.completedAt === 'string')) {
    throw new Error('运行记录接口响应格式无效');
  }

  const summaries = value.stepSummaries;
  const indices = new Set<number>();
  for (const summary of summaries) {
    if (!isRecord(summary) || !Number.isInteger(summary.index) || Number(summary.index) < 0 ||
      indices.has(Number(summary.index)) || typeof summary.action !== 'string' || !summary.action ||
      !(summary.target === null || typeof summary.target === 'string') ||
      !['ok', 'failed'].includes(String(summary.status)) ||
      !isRecord(summary.detail) ||
      !(summary.error == null || typeof summary.error === 'string')) {
      throw new Error('运行步骤摘要接口响应格式无效');
    }
    indices.add(Number(summary.index));
  }

  const stoppedAtIndex = value.stoppedAtIndex as number | null;
  const status = value.status as BusinessRun['status'];
  const triggerRejectedBeforeSteps = status === 'failed' && stoppedAtIndex === 0 &&
    value.stoppedAtAction === 'business.trigger' && summaries.length === 0;
  if ((stoppedAtIndex !== null && !indices.has(stoppedAtIndex) && !triggerRejectedBeforeSteps) ||
    (status === 'passed' && stoppedAtIndex !== null) ||
    (status === 'running' && value.completedAt !== null)) {
    throw new Error('运行记录状态与步骤摘要不一致');
  }
  if (status === 'failed' && stoppedAtIndex !== null) {
    const stoppedStep = summaries.find((summary) => (summary as Record<string, unknown>).index === stoppedAtIndex) as Record<string, unknown> | undefined;
    if (stoppedStep && stoppedStep.status !== 'failed') throw new Error('失败运行未标记对应的停止步骤');
    if (stoppedStep && value.stoppedAtAction != null && stoppedStep.action !== value.stoppedAtAction) {
      throw new Error('运行停止动作与步骤摘要不一致');
    }
  }
  return value as unknown as BusinessRun;
}

export function parseRecentBusinessRuns(value: unknown, expectedDeviceId: string): RecentBusinessRuns {
  if (!isRecord(value) || value.deviceId !== expectedDeviceId || !Number.isInteger(value.count) ||
    Number(value.count) < 0 || !Array.isArray(value.runs) || value.count !== value.runs.length) {
    throw new Error('设备运行列表接口响应格式无效');
  }
  const runs = value.runs.map((run) => parseBusinessRun(run, undefined, expectedDeviceId));
  if (new Set(runs.map((run) => run.runId)).size !== runs.length) {
    throw new Error('设备运行列表包含重复运行记录');
  }
  return value as unknown as RecentBusinessRuns;
}
