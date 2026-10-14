export interface TerminalBusiness {
  deploymentId: string;
  businessId: string;
  businessName: string;
  deploymentSerial: number;
}

export interface TerminalRuntimeStatus {
  deviceId: string;
  online: boolean;
  observedAt: string;
  configuration: { confirmation: 'confirmed' | 'unconfirmed' | 'none' | 'unknown' };
  view: {
    kind: 'section' | 'image' | 'canvas' | 'none' | 'unknown';
    sceneId: string | null;
    deploymentId: string | null;
    sectionType: string | null;
    snapshotAvailable: boolean;
  };
  businesses: TerminalBusiness[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseTerminalRuntimeStatus(value: unknown, deviceId: string): TerminalRuntimeStatus {
  const nullableString = (candidate: unknown) => candidate === null || typeof candidate === 'string';
  if (!record(value)) throw new Error('终端运行状态响应结构无效');
  const { configuration, view, businesses } = value;
  const isBusiness = (item: unknown): item is TerminalBusiness => record(item) &&
    typeof item.deploymentId === 'string' && item.deploymentId.length > 0 &&
    typeof item.businessId === 'string' && typeof item.businessName === 'string' &&
    Number.isSafeInteger(item.deploymentSerial) && typeof item.deploymentSerial === 'number';
  if (value.deviceId !== deviceId || typeof value.online !== 'boolean' ||
    typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) ||
    !record(configuration) || typeof configuration.confirmation !== 'string' ||
    !['confirmed', 'unconfirmed', 'none', 'unknown'].includes(configuration.confirmation) ||
    !record(view) || typeof view.kind !== 'string' || !['section', 'image', 'canvas', 'none', 'unknown'].includes(view.kind) ||
    !nullableString(view.sceneId) || !nullableString(view.deploymentId) ||
    !nullableString(view.sectionType) || typeof view.snapshotAvailable !== 'boolean' ||
    !Array.isArray(businesses) || !businesses.every(isBusiness) ||
    new Set(businesses.map((item) => item.deploymentId)).size !== businesses.length ||
    (view.deploymentId !== null && !businesses.some((item) => item.deploymentId === view.deploymentId))) {
    throw new Error('终端运行状态响应结构无效');
  }
  return value as unknown as TerminalRuntimeStatus;
}

export function createTerminalRuntimeLoader<T>(options: {
  getDeviceId: () => string;
  getCurrent: () => T | null;
  read: (deviceId: string) => Promise<unknown>;
  parse: (value: unknown, deviceId: string) => T;
  setValue: (value: T) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  message: (cause: unknown) => string;
}) {
  let requestId = 0;

  async function load() {
    const requestedDeviceId = options.getDeviceId();
    if (!requestedDeviceId) return;
    const currentRequestId = ++requestId;
    const isCurrent = () => requestedDeviceId === options.getDeviceId() && currentRequestId === requestId;
    options.setLoading(true);
    options.setError('');
    try {
      const response = await options.read(requestedDeviceId);
      if (!isCurrent()) return;
      options.setValue(options.parse(response, requestedDeviceId));
    } catch (cause: unknown) {
      if (isCurrent()) {
        const reason = options.message(cause);
        options.setError(options.getCurrent()
          ? `刷新失败，当前显示上次读取的状态：${reason || '请求失败'}`
          : reason || '终端运行状态读取失败');
      }
    } finally {
      if (isCurrent()) options.setLoading(false);
    }
  }

  function invalidate() {
    requestId++;
    options.setLoading(false);
  }

  return { load, invalidate };
}
