import request from '@/utils/request';

const BASE_URL = '/api/v1/sdui';

// ── Devices ──────────────────────────────────────────────────

export function getDeviceList() {
  return request({ url: `${BASE_URL}/devices`, method: 'get' });
}

export function getDeviceDetail(deviceId) {
  return request({ url: `${BASE_URL}/devices/${deviceId}`, method: 'get' });
}

export function getUnclaimedDevices() {
  return request({ url: `${BASE_URL}/devices/unclaimed`, method: 'get' });
}

export function claimDevice(deviceId, data) {
  return request({ url: `${BASE_URL}/devices/${deviceId}/claim`, method: 'post', data });
}

export function getDeviceTelemetry(deviceId) {
  return request({ url: `${BASE_URL}/devices/${deviceId}/telemetry`, method: 'get' });
}

export function sendDeviceControl(deviceId, data) {
  return request({ url: `${BASE_URL}/devices/${deviceId}/control`, method: 'post', data });
}

// ── Ops ──────────────────────────────────────────────────────

export function getOpsOverview() {
  return request({ url: `${BASE_URL}/ops/overview`, method: 'get' });
}

// ── Section orchestration (debug) ────────────────────────────

export function getSectionPresets() {
  return request({ url: `${BASE_URL}/section/presets`, method: 'get' });
}

export function sendScene(deviceId, preset) {
  return request({
    url: `${BASE_URL}/section/scene/${deviceId}`,
    method: 'post',
    params: { preset }
  });
}

export function startAutoUpdate(deviceId, preset, intervalMs) {
  return request({
    url: `${BASE_URL}/section/auto/${deviceId}/start`,
    method: 'post',
    params: { preset, intervalMs }
  });
}

export function stopAutoUpdate(deviceId) {
  return request({
    url: `${BASE_URL}/section/auto/${deviceId}/stop`,
    method: 'post'
  });
}

export function getAutoUpdateStatus() {
  return request({ url: `${BASE_URL}/section/auto/status`, method: 'get' });
}

export function getSectionCapability(deviceId) {
  return request({ url: `${BASE_URL}/section/capability/${deviceId}`, method: 'get' });
}

// ── Workflow definitions ─────────────────────────────────────

export function getWorkflowDefinitions() {
  return request({ url: `${BASE_URL}/workflow/definition`, method: 'get' });
}

export function getWorkflowDefinition(id) {
  return request({ url: `${BASE_URL}/workflow/definition/${id}`, method: 'get' });
}

export function createWorkflowDefinition(data) {
  return request({
    url: `${BASE_URL}/workflow/definition`,
    method: 'post',
    data
  });
}

export function updateWorkflowDefinition(id, data) {
  return request({
    url: `${BASE_URL}/workflow/definition/${id}`,
    method: 'put',
    data
  });
}

export function deleteWorkflowDefinition(id) {
  return request({ url: `${BASE_URL}/workflow/definition/${id}`, method: 'delete' });
}

// ── Node types (editor panel) ────────────────────────────────

export function getWorkflowNodeTypes() {
  return request({ url: `${BASE_URL}/workflow/node-types`, method: 'get' });
}

// ── Workflow runtime (debug) ─────────────────────────────────

export function loadWorkflow(deviceId, definitionId) {
  return request({
    url: `${BASE_URL}/workflow/${deviceId}/load`,
    method: 'post',
    params: { definitionId }
  });
}

export function unloadWorkflow(deviceId) {
  return request({ url: `${BASE_URL}/workflow/${deviceId}/unload`, method: 'post' });
}

export function triggerWorkflow(deviceId, triggerId) {
  return request({
    url: `${BASE_URL}/workflow/${deviceId}/trigger/${triggerId}`,
    method: 'post'
  });
}

export function getWorkflowStatus(deviceId) {
  return request({ url: `${BASE_URL}/workflow/${deviceId}/status`, method: 'get' });
}
