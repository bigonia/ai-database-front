import sduiRequest from '@/api/sdui-request';
import type { DeviceBusinessOrder, SduiDeviceInventoryPage } from '@/types/sdui-device';

const BASE = '/api/v1/sdui';

export function listSduiDevices(page = 0, size = 200): Promise<{ data: SduiDeviceInventoryPage }> {
  return sduiRequest({ url: `${BASE}/devices`, method: 'get', params: { page, size, registrationStatus: 'CLAIMED' }});
}

export function getDeviceBusinessOrder(deviceId: string): Promise<{ data: DeviceBusinessOrder }> {
  return sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/business-order`, method: 'get' });
}

export function setDeviceBusinessOrder(deviceId: string, instanceOrder: string[]): Promise<{ data: DeviceBusinessOrder }> {
  return sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/business-order`, method: 'post', data: { instanceOrder }});
}
