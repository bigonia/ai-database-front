import request from '@/utils/request';

function sduiRequest(config: Record<string, unknown>) {
  return request({ ...config, timeout: 30000, sdui: { silentBusinessError: true } });
}

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

function record(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parseTerminalRuntimeStatus(value: unknown, deviceId: string): TerminalRuntimeStatus {
  const nullableString = (value: unknown) => value === null || typeof value === 'string';
  if (!record(value) || value.deviceId !== deviceId || typeof value.online !== 'boolean'
    || typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt))
    || !record(value.configuration) || !['confirmed', 'unconfirmed', 'none', 'unknown'].includes(value.configuration.confirmation)
    || !record(value.view) || !['section', 'image', 'canvas', 'none', 'unknown'].includes(value.view.kind)
    || !nullableString(value.view.sceneId) || !nullableString(value.view.deploymentId)
    || !nullableString(value.view.sectionType) || typeof value.view.snapshotAvailable !== 'boolean'
    || !Array.isArray(value.businesses) || !value.businesses.every((item: unknown) => record(item)
      && typeof item.deploymentId === 'string' && item.deploymentId.length > 0
      && typeof item.businessId === 'string' && typeof item.businessName === 'string'
      && Number.isSafeInteger(item.deploymentSerial) && item.deploymentSerial > 0)
    || new Set(value.businesses.map((item: TerminalBusiness) => item.deploymentId)).size !== value.businesses.length
    || (value.view.deploymentId !== null && !value.businesses.some((item: TerminalBusiness) => item.deploymentId === value.view.deploymentId))) {
    throw new Error('终端运行状态响应结构无效');
  }
  return value as TerminalRuntimeStatus;
}
const path = (deviceId: string) => `/api/v1/sdui/devices/${encodeURIComponent(deviceId)}/runtime-status`;
export const getTerminalRuntimeStatus = (deviceId: string) => sduiRequest({ url: path(deviceId), method: 'get' });
export const saveTerminalBusinessOrder = (deviceId: string, deploymentIds: string[]) => sduiRequest({
  url: `${path(deviceId)}/business-order`, method: 'put', data: { deploymentIds }
});
