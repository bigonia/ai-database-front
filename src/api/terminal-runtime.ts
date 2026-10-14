import sduiRequest from '@/api/sdui-request';
export type { TerminalBusiness, TerminalRuntimeStatus } from '@/sdui/terminalRuntime';
export { parseTerminalRuntimeStatus } from '@/sdui/terminalRuntime';
const path = (deviceId: string) => `/api/v1/sdui/devices/${encodeURIComponent(deviceId)}/runtime-status`;
export const getTerminalRuntimeStatus = (deviceId: string) => sduiRequest({ url: path(deviceId), method: 'get' });
export const saveTerminalBusinessOrder = (deviceId: string, deploymentIds: string[]) => sduiRequest({
  url: `${path(deviceId)}/business-order`, method: 'put', data: { deploymentIds }
});
