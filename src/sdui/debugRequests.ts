import type { DebugAvailableRequests, DebugJournalEntry, DebugRequestResult } from '@/types/sdui-debug';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isDebugParameter(value: unknown): value is DebugAvailableRequests['requests'][number]['params'][number] {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name ||
    typeof value.type !== 'string' || !value.type ||
    !(value.required == null || typeof value.required === 'boolean') ||
    !(value.min == null || (typeof value.min === 'number' && Number.isFinite(value.min))) ||
    !(value.max == null || (typeof value.max === 'number' && Number.isFinite(value.max))) ||
    (value.min != null && value.max != null && Number(value.min) > Number(value.max)) ||
    !(value.unit == null || typeof value.unit === 'string') ||
    !(value.values == null || (Array.isArray(value.values) &&
      value.values.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))))) return false;
  if (Array.isArray(value.values) && new Set(value.values.map(item => `${typeof item}:${String(item)}`)).size !== value.values.length) return false;
  if (Array.isArray(value.values) && ['int', 'integer', 'float', 'number'].includes(value.type) &&
    !value.values.every(item => typeof item === 'number' && Number.isFinite(item))) return false;
  if (Array.isArray(value.values) && value.type === 'boolean' && !value.values.every(item => typeof item === 'boolean')) return false;
  if (Array.isArray(value.values) && ['text', 'string', 'url', 'color'].includes(value.type) &&
    !value.values.every(item => typeof item === 'string')) return false;
  return true;
}

function isJournalEntry(value: unknown): value is DebugJournalEntry {
  return isRecord(value) && typeof value.requestId === 'string' && typeof value.name === 'string' &&
    isRecord(value.params) && typeof value.ok === 'boolean' &&
    (value.error == null || typeof value.error === 'string') && typeof value.declared === 'boolean' &&
    (value.detail == null || isRecord(value.detail)) && typeof value.at === 'string';
}

export function parseAvailableRequests(value: unknown, expectedDeviceId: string): DebugAvailableRequests {
  if (!isRecord(value) || value.deviceId !== expectedDeviceId || typeof value.online !== 'boolean' ||
    !Array.isArray(value.requests)) throw new Error('设备请求目录响应结构无效');
  const requestNames = new Set<string>();
  const validRequests = value.requests.every(item => {
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name || requestNames.has(item.name) ||
      !Array.isArray(item.usableIn) || !item.usableIn.every(entry => typeof entry === 'string') ||
      new Set(item.usableIn).size !== item.usableIn.length || typeof item.usableInBinding !== 'boolean' ||
      item.usableInRequest !== true || !(item.description == null || typeof item.description === 'string') ||
      !Array.isArray(item.params) || !item.params.every(isDebugParameter) ||
      new Set(item.params.map(param => (param as unknown as UnknownRecord).name)).size !== item.params.length ||
      !(item.parameters == null || (Array.isArray(item.parameters) && item.parameters.every(isDebugParameter))) ||
      !(item.parametersSource == null || typeof item.parametersSource === 'string')) return false;
    requestNames.add(item.name);
    return true;
  });
  if (!validRequests) throw new Error('设备请求目录条目结构无效');
  return value as unknown as DebugAvailableRequests;
}

export function parseJournalEntry(value: unknown): value is DebugJournalEntry {
  return isJournalEntry(value);
}

export function parseRequestResult(value: unknown): DebugRequestResult {
  if (!isRecord(value) || typeof value.requestId !== 'string' || typeof value.name !== 'string' ||
    typeof value.ok !== 'boolean' || !(value.error == null || typeof value.error === 'string') ||
    typeof value.declared !== 'boolean' || typeof value.reachable !== 'boolean' || !isRecord(value.extra)) {
    throw new Error('设备请求响应结构无效');
  }
  return value as unknown as DebugRequestResult;
}

export function parseRequestHistory(value: unknown, expectedDeviceId: string): DebugJournalEntry[] {
  if (!isRecord(value) || value.deviceId !== expectedDeviceId || !Array.isArray(value.history) ||
    !value.history.every(isJournalEntry)) throw new Error('请求历史响应结构无效');
  return value.history;
}

type DeviceReadRequest = {
  deviceId: string;
  generation: number;
  isCurrent: (deviceId: string, generation: number) => boolean;
  read: () => Promise<unknown>;
};

type DeviceReadResult<T> =
  | { kind: 'stale' }
  | { kind: 'failure'; message: string }
  | { kind: 'success'; value: T };

async function readForDevice<T>(
  request: DeviceReadRequest,
  parse: (value: unknown, deviceId: string) => T
): Promise<DeviceReadResult<T>> {
  try {
    const value = parse(await request.read(), request.deviceId);
    if (!request.isCurrent(request.deviceId, request.generation)) return { kind: 'stale' };
    return { kind: 'success', value };
  } catch (error) {
    if (!request.isCurrent(request.deviceId, request.generation)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error ? error.message : '' };
  }
}

export function loadDebugRequestDirectory(request: DeviceReadRequest): Promise<DeviceReadResult<DebugAvailableRequests>> {
  return readForDevice(request, parseAvailableRequests);
}

export function loadDebugRequestHistory(request: DeviceReadRequest): Promise<DeviceReadResult<DebugJournalEntry[]>> {
  return readForDevice(request, parseRequestHistory);
}

export function loadDebugHistoryDetail(request: DeviceReadRequest, requestId: string): Promise<DeviceReadResult<DebugJournalEntry>> {
  return readForDevice(request, (value) => {
    if (!parseJournalEntry(value) || value.requestId !== requestId) throw new Error('请求详情响应结构无效');
    return value;
  });
}
