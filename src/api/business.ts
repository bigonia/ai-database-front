import request from '@/utils/request';
import { runSduiOperation } from '@/utils/sdui-log';

const BASE = '/api/v1/sdui';
const SDUI_TIMEOUT = 30000;

function sduiRequest(config: Record<string, unknown>, timeout = SDUI_TIMEOUT) {
  return request({ ...config, timeout, sdui: { silentBusinessError: true } });
}

export interface BusinessSummary {
  businessId: string;
  name: string;
  description: string | null;
  revision: number;
  uis: number;
  flows: string[];
  mirror: boolean;
}

export interface BusinessUiResource {
  key: string;
  owner: 'local' | 'target';
  template: string;
  fields: Record<string, unknown>;
}

export interface BusinessEditorResources {
  businessId: string;
  uis: Array<{
    kind: string;
    key: string;
    owner: 'local' | 'target' | null;
    template: string;
    initial: boolean;
    origin: string;
    referencedBy: string[];
  }>;
  values: Array<{
    kind: string;
    name: string;
    type: string;
    flowKey: string;
    origin: string;
    fromTrigger: boolean;
    stepIndex: number;
    transient: boolean;
  }>;
}

export interface BusinessStep {
  action: string;
  target?: 'local' | 'target';
  with?: Record<string, unknown>;
  produces?: Record<string, string>;
  ui?: string;
  bind?: Record<string, unknown>;
}

export interface DeviceFlowEntry {
  kind: 'device';
  ui?: string;
  interaction?: string;
}

export interface ExternalFlowEntry {
  kind: 'external';
  name?: string;
  values?: Record<string, string>;
  valueDescriptions?: Record<string, string>;
}

export interface BusinessFlow {
  key: string;
  entry?: DeviceFlowEntry | ExternalFlowEntry;
  steps: BusinessStep[];
}

export interface BusinessDefinition {
  id: string;
  name: string;
  description?: string;
  devices?: { local?: Record<string, never>; target?: Record<string, never> };
  uis: BusinessUiResource[];
  flows: BusinessFlow[];
  mirror?: boolean;
}

export interface ConfigProblem {
  severity: 'error' | 'warning';
  code: string;
  location: string;
  expected?: string;
  actual?: string;
  fix: string;
  converter?: string;
}

export interface ValidationProjection {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  problems: ConfigProblem[];
}

export function parseValidationProjection(value: unknown): ValidationProjection {
  if (!isRecord(value) || typeof value.ok !== 'boolean'
    || !Number.isInteger(value.errorCount) || Number(value.errorCount) < 0
    || !Number.isInteger(value.warningCount) || Number(value.warningCount) < 0
    || !Array.isArray(value.problems)) {
    throw new Error('业务校验响应格式无效');
  }
  const problems = value.problems.map((problem) => {
    if (!isRecord(problem) || !['error', 'warning'].includes(String(problem.severity))
      || typeof problem.code !== 'string' || !problem.code
      || typeof problem.location !== 'string' || !problem.location
      || typeof problem.fix !== 'string' || !problem.fix
      || !(problem.expected == null || typeof problem.expected === 'string')
      || !(problem.actual == null || typeof problem.actual === 'string')
      || !(problem.converter == null || typeof problem.converter === 'string')) {
      throw new Error('业务校验问题列表格式无效');
    }
    return problem as unknown as ConfigProblem;
  });
  const errorCount = problems.filter((problem) => problem.severity === 'error').length;
  const warningCount = problems.length - errorCount;
  if (value.errorCount !== errorCount || value.warningCount !== warningCount || value.ok !== (errorCount === 0)) {
    throw new Error('业务校验汇总与问题列表不一致');
  }
  return { ok: value.ok, errorCount, warningCount, problems };
}

export interface SectionField {
  name: string;
  type: string;
  label?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  options?: string[];
  description?: string;
  required?: boolean;
  parameterizable?: boolean;
  children?: SectionField[];
}

export interface SectionTemplate {
  type: string;
  displayName: string;
  interactive: boolean;
  displayFields: SectionField[];
  constraints?: Record<string, number>;
}

export interface ActionCatalogEntry {
  action: string;
  role?: string;
  version?: string;
  source?: string;
  timeoutMs?: number;
  errors?: string[];
  idempotent?: boolean;
  description?: string;
  parameters?: ActionParameterDocumentation[];
  parametersSource?: string;
  in?: Record<string, string>;
  out?: Record<string, string>;
  usableIn?: string[];
}

export interface ActionCatalogResponse {
  deviceId: string | null;
  schemaSynced: boolean;
  count: number;
  actions: ActionCatalogEntry[];
}

export interface ActionParameterDocumentation {
  name: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  values?: unknown[];
}

export interface SduiDeviceOption {
  deviceId: string;
  name?: string;
  status?: string;
  capabilitySyncState?: string | null;
  online?: boolean;
  board?: string;
  registrationStatus?: string;
}

export interface SduiDeviceInventoryPage {
  totalCount: number;
  page: number;
  size: number;
  items: SduiDeviceOption[];
}

export interface DeploymentFrozen {
  deploymentId: string;
  businessId: string;
  localDeviceId: string;
  targetDeviceIds: string[];
  triggers: string[];
  credential?: string | null;
  initialFlowKey?: string | null;
  initialRunId?: string | null;
  initialRunDuplicate: boolean;
}

export interface DeploymentPreflight {
  deploymentId: string;
  deployable: number;
  blocked: number;
  blocks: string[];
  devices: Array<{
    deviceId: string;
    role: 'local' | 'target' | string;
    online: boolean;
    willDeploy: boolean;
    blockingReason: string | null;
  }>;
}

export interface DeploymentStatus {
  deploymentId: string;
  businessId: string;
  businessName: string;
  deploymentSerial: number;
  status: 'active' | 'stopped';
  slotBindings: { local: string; target?: string | null };
  deviceStatuses: Record<string, { status: string; error: string | null; online: boolean; installing: boolean }>;
  deviceIds: string[];
  deployedAt: string | null;
  stoppedAt: string | null;
}

export interface DeploymentBusinessSnapshot {
  deploymentId: string;
  businessId: string;
  available: boolean;
  sourceAvailable: boolean;
  differsFromSource: boolean;
  definition: Record<string, unknown>;
}

export interface DeploymentPage {
  items: DeploymentStatus[];
  page: number;
  size: number;
  totalElements: number;
}

export interface DeploymentOperationResult {
  deploymentId: string;
  online?: number;
  offline: number;
  succeeded: number;
  failed: number;
  devices: Array<{
    deviceId: string;
    role: 'local' | 'target' | string;
    status: string;
    error: string | null;
  }>;
}

export interface DeploymentCredential {
  deploymentId: string;
  businessId: string;
  deviceId: string;
  triggers: string[];
  endpoint: string;
  credentialSource: string;
}

export interface DeploymentCredentialExport {
  deploymentId: string;
  businessId: string;
  deviceId: string;
  triggers: string[];
  endpoint: string;
  tenantId: string;
  credential: string;
}

export interface BusinessExportProjection {
  businessId: string;
  name: string;
  description: string;
  tenantId: string;
  authentication: string;
  instructions: string;
  instances: Array<{
    deviceId: string;
    method: string;
    endpoint: string;
    resultMethod: string;
    resultEndpoint: string;
    credential: string;
    triggers: Array<{ name: string; flowKey: string; values: Array<{ name: string; type: string; description?: string; required: boolean }> }>;
  }>;
}

export interface BusinessRun {
  runId: string;
  businessId: string;
  deploymentId: string;
  deviceId: string;
  flowKey: string;
  triggerSource: string;
  invocationId: string;
  status: 'passed' | 'failed' | 'running';
  stoppedAtIndex: number | null;
  stoppedAtAction: string | null;
  error: string | null;
  stepSummaries: Array<{
    index: number;
    action: string;
    target: string | null;
    status: 'ok' | 'failed';
    detail: Record<string, unknown>;
    error?: string | null;
  }>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RecentBusinessRuns {
  deviceId: string;
  count: number;
  runs: BusinessRun[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseBusinessRun(value: unknown, expectedRunId?: string, expectedDeviceId?: string): BusinessRun {
  if (!isRecord(value) || typeof value.runId !== 'string' || !value.runId
    || (expectedRunId !== undefined && value.runId !== expectedRunId)
    || typeof value.businessId !== 'string' || !value.businessId
    || typeof value.deploymentId !== 'string' || !value.deploymentId
    || typeof value.deviceId !== 'string' || !value.deviceId
    || (expectedDeviceId !== undefined && value.deviceId !== expectedDeviceId)
    || typeof value.flowKey !== 'string' || !value.flowKey
    || typeof value.triggerSource !== 'string' || !value.triggerSource
    || typeof value.invocationId !== 'string' || !value.invocationId
    || !['passed', 'failed', 'running'].includes(String(value.status))
    || !(value.stoppedAtIndex === null || (Number.isInteger(value.stoppedAtIndex) && Number(value.stoppedAtIndex) >= 0))
    || !(value.stoppedAtAction === null || typeof value.stoppedAtAction === 'string')
    || !(value.error === null || typeof value.error === 'string')
    || !Array.isArray(value.stepSummaries)
    || !(value.startedAt === null || typeof value.startedAt === 'string')
    || !(value.completedAt === null || typeof value.completedAt === 'string')) {
    throw new Error('运行记录接口响应格式无效');
  }

  const summaries = value.stepSummaries;
  const indices = new Set<number>();
  for (const summary of summaries) {
    if (!isRecord(summary) || !Number.isInteger(summary.index) || Number(summary.index) < 0
      || indices.has(Number(summary.index)) || typeof summary.action !== 'string' || !summary.action
      || !(summary.target === null || typeof summary.target === 'string')
      || !['ok', 'failed'].includes(String(summary.status))
      || !isRecord(summary.detail)
      || !(summary.error == null || typeof summary.error === 'string')) {
      throw new Error('运行步骤摘要接口响应格式无效');
    }
    indices.add(Number(summary.index));
  }

  const stoppedAtIndex = value.stoppedAtIndex as number | null;
  const status = value.status as BusinessRun['status'];
  const triggerRejectedBeforeSteps = status === 'failed' && stoppedAtIndex === 0
    && value.stoppedAtAction === 'business.trigger' && summaries.length === 0;
  if ((stoppedAtIndex !== null && !indices.has(stoppedAtIndex) && !triggerRejectedBeforeSteps)
    || (status === 'passed' && stoppedAtIndex !== null)
    || (status === 'running' && value.completedAt !== null)) {
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
  if (!isRecord(value) || value.deviceId !== expectedDeviceId || !Number.isInteger(value.count)
    || Number(value.count) < 0 || !Array.isArray(value.runs) || value.count !== value.runs.length) {
    throw new Error('设备运行列表接口响应格式无效');
  }
  const runs = value.runs.map((run) => parseBusinessRun(run, undefined, expectedDeviceId));
  if (new Set(runs.map((run) => run.runId)).size !== runs.length) {
    throw new Error('设备运行列表包含重复运行记录');
  }
  return value as unknown as RecentBusinessRuns;
}

export function listBusinesses() {
  return sduiRequest({ url: `${BASE}/businesses`, method: 'get' });
}

export function deleteBusiness(businessId: string) {
  return sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'delete' });
}

export function getBusiness(businessId: string) {
  return sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'get' });
}

export function saveBusiness(businessId: string, expectedRevision: number, definition: BusinessDefinition) {
  return runSduiOperation('business.definition.save', { businessId }, () =>
    sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'put', data: { expectedRevision, definition } }));
}

export function validateBusiness(businessId: string, definition?: BusinessDefinition) {
  return definition
    ? sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/diagnostics/validate-draft`, method: 'post', data: definition })
    : sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/diagnostics/validate`, method: 'get' });
}

export function getBusinessResources(businessId: string): Promise<{ data: BusinessEditorResources }> {
  return sduiRequest({ url: `${BASE}/editor/businesses/${encodeURIComponent(businessId)}/resources`, method: 'get' });
}

export function getSectionCatalog() {
  return sduiRequest({ url: `${BASE}/catalog/sections`, method: 'get' });
}

export function parseSectionCatalog(value: unknown): Record<string, SectionTemplate> {
  if (!isRecord(value)) throw new Error('界面模板目录响应格式无效');
  const parseField = (candidate: unknown, path: string): SectionField => {
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || !candidate.name
      || typeof candidate.type !== 'string' || !candidate.type
      || !(candidate.label == null || typeof candidate.label === 'string')
      || !(candidate.description == null || typeof candidate.description === 'string')
      || !(candidate.required == null || typeof candidate.required === 'boolean')
      || !(candidate.parameterizable == null || typeof candidate.parameterizable === 'boolean')
      || !(candidate.min == null || (typeof candidate.min === 'number' && Number.isFinite(candidate.min)))
      || !(candidate.max == null || (typeof candidate.max === 'number' && Number.isFinite(candidate.max)))
      || (candidate.min != null && candidate.max != null && Number(candidate.min) > Number(candidate.max))
      || !(candidate.options == null || (Array.isArray(candidate.options)
        && candidate.options.every((option) => typeof option === 'string')))
      || !(candidate.children == null || Array.isArray(candidate.children))) {
      throw new Error(`${path} 字段定义无效`);
    }
    const type = candidate.type;
    const defaultValue = candidate.defaultValue;
    if (defaultValue !== undefined) {
      const validDefault = ['text', 'string', 'url', 'color'].includes(String(type))
        ? typeof defaultValue === 'string'
        : ['number', 'integer', 'int', 'float'].includes(String(type))
          ? typeof defaultValue === 'number' && Number.isFinite(defaultValue)
          : type === 'boolean' ? typeof defaultValue === 'boolean'
            : type === 'array' ? Array.isArray(defaultValue)
              : type === 'object' ? isRecord(defaultValue)
                : true;
      if (!validDefault) throw new Error(`${path} 默认值类型与字段类型不匹配`);
    }
    if (type !== 'array' && candidate.children != null && candidate.children.length > 0) {
      throw new Error(`${path} 非数组字段不能声明子字段`);
    }
    const children = (candidate.children || []).map((child, index) => parseField(child, `${path}.children[${index}]`));
    if (new Set(children.map((child) => child.name)).size !== children.length) {
      throw new Error(`${path} 包含重复子字段`);
    }
    return { ...candidate, children } as unknown as SectionField;
  };

  const parsed: Record<string, SectionTemplate> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!isRecord(candidate) || candidate.type !== key || typeof candidate.displayName !== 'string'
      || !candidate.displayName || typeof candidate.interactive !== 'boolean'
      || !Array.isArray(candidate.displayFields)) {
      throw new Error(`界面模板“${key}”定义无效`);
    }
    const fields = candidate.displayFields.map((field, index) => parseField(field, `${key}.displayFields[${index}]`));
    if (new Set(fields.map((field) => field.name)).size !== fields.length) {
      throw new Error(`界面模板“${key}”包含重复字段`);
    }
    const constraints = candidate.constraints;
    if (constraints != null && (!isRecord(constraints)
      || Object.values(constraints).some((constraint) => !Number.isSafeInteger(constraint)))) {
      throw new Error(`界面模板“${key}”约束定义无效`);
    }
    const arrayFieldNames = new Set(fields.filter((field) => field.type === 'array').map((field) => field.name));
    const arrayCountConstraint = (name: string) => [...arrayFieldNames]
      .some((fieldName) => name === `${fieldName}_min` || name === `${fieldName}_max`);
    if (constraints && Object.entries(constraints).some(([name, constraint]) =>
      arrayCountConstraint(name) && Number(constraint) < 0)) {
      throw new Error(`界面模板“${key}”数组项数约束不能为负数`);
    }
    if (constraints && Object.entries(constraints).some(([name, minimum]) =>
      [...arrayFieldNames].some((fieldName) => name === `${fieldName}_min`
        && constraints[`${fieldName}_max`] != null
        && Number(minimum) > Number(constraints[`${fieldName}_max`] as number)))) {
      throw new Error(`界面模板“${key}”数组最小项数不能大于最大项数`);
    }
    parsed[key] = { type: key, displayName: candidate.displayName, interactive: candidate.interactive,
      displayFields: fields, constraints: constraints as Record<string, number> | undefined };
  }
  return parsed;
}

export function getTriggerCatalog() {
  return sduiRequest({ url: `${BASE}/catalog/triggers`, method: 'get' });
}

export function getActionCatalog(deviceId?: string) {
  return sduiRequest({ url: `${BASE}/actions/catalog`, method: 'get', params: deviceId ? { deviceId } : undefined });
}

export function parseActionCatalog(value: unknown, expectedDeviceId?: string): ActionCatalogResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('动作目录响应格式无效');
  const data = value as Record<string, unknown>;
  if (!(data.deviceId === null || typeof data.deviceId === 'string')
    || data.deviceId !== (expectedDeviceId || null)
    || typeof data.schemaSynced !== 'boolean'
    || !Number.isInteger(data.count) || Number(data.count) < 0
    || !Array.isArray(data.actions) || data.count !== data.actions.length) {
    throw new Error('动作目录身份、计数或同步状态与请求不匹配');
  }
  const names = new Set<string>();
  for (const item of data.actions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('动作目录条目格式无效');
    const action = item as Record<string, unknown>;
    if (typeof action.action !== 'string' || !action.action || names.has(action.action)
      || !(action.role === undefined || typeof action.role === 'string')
      || !(action.version === undefined || typeof action.version === 'string')
      || !(action.source === undefined || typeof action.source === 'string')
      || !(action.timeoutMs === undefined || action.timeoutMs === null || (Number.isInteger(action.timeoutMs) && Number(action.timeoutMs) >= 0))
      || !(action.errors === undefined || action.errors === null || (Array.isArray(action.errors) && action.errors.every((error) => typeof error === 'string')))
      || !(action.idempotent === undefined || typeof action.idempotent === 'boolean')
      || !(action.description === undefined || action.description === null || typeof action.description === 'string')
      || !(action.parametersSource === undefined || action.parametersSource === null || typeof action.parametersSource === 'string')
      || !(action.parameters === undefined || action.parameters === null || (Array.isArray(action.parameters) && action.parameters.every(isActionParameter)))
      || !(action.in === undefined || isStringMap(action.in))
      || !(action.out === undefined || isStringMap(action.out))
      || !(action.usableIn === undefined || action.usableIn === null || (Array.isArray(action.usableIn) && action.usableIn.every((surface) => typeof surface === 'string')))) {
      throw new Error('动作目录条目字段格式无效或存在重复动作名');
    }
    names.add(action.action);
  }
  return value as ActionCatalogResponse;
}

function isActionParameter(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const parameter = value as Record<string, unknown>;
  return typeof parameter.name === 'string' && parameter.name.length > 0
    && typeof parameter.type === 'string' && parameter.type.length > 0
    && (parameter.required === undefined || parameter.required === null || typeof parameter.required === 'boolean')
    && (parameter.min === undefined || parameter.min === null || Number.isFinite(parameter.min))
    && (parameter.max === undefined || parameter.max === null || Number.isFinite(parameter.max))
    && (parameter.unit === undefined || parameter.unit === null || typeof parameter.unit === 'string')
    && (parameter.values === undefined || parameter.values === null || Array.isArray(parameter.values));
}

function isStringMap(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every((item) => typeof item === 'string');
}

export function listSduiDevices(page = 0, size = 200): Promise<{ data: SduiDeviceInventoryPage }> {
  return sduiRequest({ url: `${BASE}/devices`, method: 'get', params: { page, size, registrationStatus: 'CLAIMED' } });
}

export function deployBusiness(businessId: string, bindings: { expectedRevision: number; localDeviceId: string; targetDeviceId?: string }): Promise<{ data: { deployment: DeploymentFrozen; installation: DeploymentOperationResult } }> {
  return runSduiOperation('business.deployment.deploy', { businessId, ...bindings }, () =>
    sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/deployments`, method: 'post', data: { expectedRevision: bindings.expectedRevision, localDeviceId: bindings.localDeviceId, targetDeviceIds: bindings.targetDeviceId ? [bindings.targetDeviceId] : [] } }, 180000));
}

export function getDeploymentPreflight(deploymentId: string): Promise<{ data: DeploymentPreflight }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/preflight`, method: 'get' }, 60000);
}

export function installDeployment(deploymentId: string): Promise<{ data: DeploymentOperationResult }> {
  return runSduiOperation('business.deployment.install', { deploymentId }, () =>
    sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/install`, method: 'post' }, 120000));
}

export function uninstallDeployment(deploymentId: string) {
  return runSduiOperation('business.deployment.uninstall', { deploymentId }, () =>
    sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/uninstall`, method: 'post' }, 120000));
}

export function getDeployment(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}`, method: 'get' });
}

export function getDeploymentSnapshot(deploymentId: string): Promise<{ data: DeploymentBusinessSnapshot }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/snapshot`, method: 'get' }) as Promise<{ data: DeploymentBusinessSnapshot }>;
}

export function deleteDeployment(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}`, method: 'delete' });
}

export function listDeployments(page = 0, size = 20, businessId?: string) {
  return sduiRequest({ url: `${BASE}/deployments`, method: 'get', params: { page, size, businessId } });
}

export function getDeploymentCredential(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/credential`, method: 'get' });
}

export function exportDeploymentCredential(deploymentId: string): Promise<{ data: DeploymentCredentialExport }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/credential/export`, method: 'post' });
}

export function getDeploymentExport(deploymentId: string): Promise<{ data: BusinessExportProjection }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/export`, method: 'get' });
}

export function getBusinessExport(businessId: string) {
  return sduiRequest({ url: `${BASE}/ai/apps/${encodeURIComponent(businessId)}/export`, method: 'get' });
}

export function getDeviceRuns(deviceId: string, limit = 20) {
  return sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/runs`, method: 'get', params: { limit } });
}

export function getBusinessRun(runId: string) {
  return sduiRequest({ url: `${BASE}/runs/${encodeURIComponent(runId)}`, method: 'get' });
}

export function getDeploymentRuns(deploymentId: string, page = 0, size = 20): Promise<{data: {deploymentId: string; page: number; size: number; totalElements: number; runs: unknown[]}}> {
  return sduiRequest({url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/runs`, method: 'get', params: {page, size}});
}
export function installDeploymentDevice(deploymentId: string, deviceId: string): Promise<{data: DeploymentOperationResult}> {
  return sduiRequest({url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/devices/${encodeURIComponent(deviceId)}/install`, method: 'post'});
}
export function uninstallDeploymentDevice(deploymentId: string, deviceId: string): Promise<{data: DeploymentOperationResult}> {
  return sduiRequest({url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/devices/${encodeURIComponent(deviceId)}/uninstall`, method: 'post'});
}

export interface DeviceBusinessOrder {
  deviceId: string;
  primaryInstanceId: string | null;
  instanceOrder: string[];
  instanceLabels: Record<string, { businessName: string; deploymentSerial: number }>;
}

export function getDeviceBusinessOrder(deviceId: string): Promise<{data: DeviceBusinessOrder}> {
  return sduiRequest({url: `${BASE}/devices/${encodeURIComponent(deviceId)}/business-order`, method: 'get'});
}

export function setDeviceBusinessOrder(deviceId: string, instanceOrder: string[]): Promise<{data: DeviceBusinessOrder}> {
  return sduiRequest({url: `${BASE}/devices/${encodeURIComponent(deviceId)}/business-order`, method: 'post', data: {instanceOrder}});
}
