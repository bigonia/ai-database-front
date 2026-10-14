import type { ValidationProjection } from '@/types/sdui-business';
import type { DeploymentFrozen, DeploymentOperationResult } from '@/types/sdui-deployment';

type DeploymentBindings = {
  expectedRevision: number;
  localDeviceId: string;
  targetDeviceId?: string;
};

type DeploymentResult = {
  deployment: DeploymentFrozen;
  installation: DeploymentOperationResult;
};

export interface BusinessDeploymentAttempt {
  businessId: string;
  generation: number;
  isCurrent: (businessId: string, generation: number) => boolean;
  isDirty: () => boolean;
  getValidation: () => ValidationProjection | null;
  getValidationError: () => string;
  getBindings: () => {
    revision: number;
    localDeviceId: string;
    targetDeviceId: string;
    hasTarget: boolean;
  };
  validate: () => Promise<boolean>;
}

export type BusinessDeploymentOutcome =
  | { kind: 'ignored' }
  | { kind: 'warning'; message: string }
  | { kind: 'invalid'; validation: ValidationProjection | null; message?: string }
  | { kind: 'success'; result: DeploymentResult }
  | { kind: 'failure'; message: string; outcomeUnknown: boolean };

export function canStartBusinessDeployment(state: {
  loading: boolean;
  deploymentId: string;
  outcomeUnknown: boolean;
}): boolean {
  return !state.loading && !state.deploymentId && !state.outcomeUnknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === 'string' && value.message
    ? value.message
    : fallback;
}

export function isDeploymentFrozen(value: unknown, expectedBusinessId: string,
  expectedBindings: DeploymentBindings): value is DeploymentFrozen {
  return isRecord(value) && typeof value.deploymentId === 'string' && value.deploymentId.length > 0 &&
    value.businessId === expectedBusinessId &&
    typeof value.localDeviceId === 'string' && value.localDeviceId === expectedBindings.localDeviceId &&
    Array.isArray(value.targetDeviceIds) &&
    value.targetDeviceIds.length === (expectedBindings.targetDeviceId ? 1 : 0) &&
    (!expectedBindings.targetDeviceId || value.targetDeviceIds[0] === expectedBindings.targetDeviceId) &&
    (!expectedBindings.targetDeviceId || value.localDeviceId !== expectedBindings.targetDeviceId) &&
    Array.isArray(value.triggers) && value.triggers.every((item) => typeof item === 'string' && item.length > 0) &&
    typeof value.initialRunDuplicate === 'boolean' &&
    (value.initialFlowKey === null || typeof value.initialFlowKey === 'string' || value.initialFlowKey === undefined) &&
    (value.initialRunId === null || typeof value.initialRunId === 'string' || value.initialRunId === undefined) &&
    (value.credential === null || typeof value.credential === 'string' || value.credential === undefined);
}

function frozenDeviceRoles(value: DeploymentFrozen): Map<string, string> {
  const roles = new Map<string, string>();
  if (value.localDeviceId) roles.set(value.localDeviceId, 'local');
  for (const id of value.targetDeviceIds) roles.set(id, 'target');
  return roles;
}

export function isInstallResult(value: unknown, expectedDeploymentId: string,
  frozen: DeploymentFrozen): value is DeploymentOperationResult {
  if (!isRecord(value) || value.deploymentId !== expectedDeploymentId ||
    !Number.isInteger(value.offline) || Number(value.offline) < 0 ||
    !Number.isInteger(value.succeeded) || Number(value.succeeded) < 0 ||
    !Number.isInteger(value.failed) || Number(value.failed) < 0 ||
    !Array.isArray(value.devices)) return false;
  const expectedRoles = frozenDeviceRoles(frozen);
  const seen = new Set<string>();
  let succeeded = 0;
  let offline = 0;
  let failed = 0;
  for (const item of value.devices) {
    if (!isRecord(item) || typeof item.deviceId !== 'string' || !expectedRoles.has(item.deviceId) ||
      seen.has(item.deviceId) || item.role !== expectedRoles.get(item.deviceId) ||
      !['ok', 'failed', 'skipped'].includes(String(item.status)) ||
      !(item.error === null || typeof item.error === 'string')) return false;
    seen.add(item.deviceId);
    if (item.status === 'ok') succeeded += 1;
    else if (item.status === 'failed') failed += 1;
    else offline += 1;
  }
  return seen.size === expectedRoles.size && succeeded === value.succeeded && offline === value.offline &&
    failed === value.failed && succeeded + offline + failed === value.devices.length;
}

function responseData(value: unknown): unknown {
  return isRecord(value) ? value.data : undefined;
}

function deploymentResult(value: unknown): value is DeploymentResult {
  return isRecord(value) && 'deployment' in value && 'installation' in value;
}

export async function executeBusinessDeployment(
  attempt: BusinessDeploymentAttempt,
  deploy: (businessId: string, bindings: DeploymentBindings) => Promise<unknown>
): Promise<BusinessDeploymentOutcome> {
  const { businessId, generation } = attempt;
  const current = () => attempt.isCurrent(businessId, generation);
  if (!current()) return { kind: 'ignored' };
  const initialBindings = attempt.getBindings();
  if (!initialBindings.localDeviceId) return { kind: 'warning', message: '请选择本机终端' };
  if (initialBindings.hasTarget && !initialBindings.targetDeviceId) return { kind: 'warning', message: '请选择对端终端' };
  if (initialBindings.hasTarget && initialBindings.localDeviceId === initialBindings.targetDeviceId) {
    return { kind: 'warning', message: '本机与对端必须选择不同终端' };
  }
  if (attempt.isDirty()) return { kind: 'warning', message: '当前草稿尚未保存。请关闭弹窗，保存后再部署。' };
  if (!await attempt.validate()) {
    const validation = attempt.getValidation();
    return {
      kind: 'invalid',
      validation,
      ...(validation ? {} : { message: attempt.getValidationError() })
    };
  }
  if (!current()) return { kind: 'ignored' };
  const validation = attempt.getValidation();
  if (attempt.isDirty() || validation?.ok !== true) {
    return {
      kind: 'warning',
      message: attempt.isDirty()
        ? '校验期间草稿发生变化，请保存后重新部署。'
        : '草稿校验未通过，请修复问题后重试。'
    };
  }

  const currentBindings = attempt.getBindings();
  const bindings = {
    expectedRevision: currentBindings.revision,
    localDeviceId: currentBindings.localDeviceId,
    targetDeviceId: currentBindings.hasTarget ? currentBindings.targetDeviceId : undefined
  };
  let requestStarted = false;
  try {
    requestStarted = true;
    const result = responseData(await deploy(businessId, bindings));
    if (!current()) return { kind: 'ignored' };
    if (!deploymentResult(result) || !isDeploymentFrozen(result.deployment, businessId, bindings)) {
      throw new Error('部署回执与本次请求不一致');
    }
    if (!isInstallResult(result.installation, result.deployment.deploymentId, result.deployment)) {
      throw new Error('设备下发结果无效，请查看部署详情');
    }
    return { kind: 'success', result: result as unknown as DeploymentResult };
  } catch (cause) {
    if (!current()) return { kind: 'ignored' };
    const httpStatus = isRecord(cause) && isRecord(cause.response) ? cause.response.status : undefined;
    const hasApiResponse = isRecord(cause) && Boolean(cause.apiResponse);
    const outcomeUnknown = requestStarted && !hasApiResponse &&
      (!Number.isInteger(httpStatus) || Number(httpStatus) >= 500);
    return { kind: 'failure', message: errorMessage(cause, '部署失败'), outcomeUnknown };
  }
}
