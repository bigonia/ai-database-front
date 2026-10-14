import sduiRequest from '@/api/sdui-request';

const BASE = '/api/v1/sdui';

export function getDeviceRuns(deviceId: string, limit = 20) {
  return sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/runs`, method: 'get', params: { limit }});
}

export function getBusinessRun(runId: string) {
  return sduiRequest({ url: `${BASE}/runs/${encodeURIComponent(runId)}`, method: 'get' });
}

export function getDeploymentRuns(deploymentId: string, page = 0, size = 20): Promise<{data: {deploymentId: string; page: number; size: number; totalElements: number; runs: unknown[]}}> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/runs`, method: 'get', params: { page, size }});
}
