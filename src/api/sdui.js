import request from '@/utils/request';
import axios from 'axios';
import { getToken } from '@/utils/auth';

const BASE = '/api/v1/sdui';

// ═══════════════════════════════════════════════════════════════════
// Module 1 — Devices  (/api/v1/sdui/devices)
// ═══════════════════════════════════════════════════════════════════

/** 3.1 设备卡片列表 (paginated, filterable) */
export function getDeviceList(params) {
  return request({ url: `${BASE}/devices`, method: 'get', params });
}

/** 3.2 未认领设备列表 */
export function getUnclaimedDevices() {
  return request({ url: `${BASE}/devices/unclaimed`, method: 'get' });
}

/** 3.3 设备类型汇总 (auto-discovered board aggregation) */
export function getDeviceTypes() {
  return request({ url: `${BASE}/devices/types`, method: 'get' });
}

/** 4.1 设备完整快照 */
export function getDeviceDetail(deviceId) {
  return request({ url: `${BASE}/devices/${deviceId}`, method: 'get' });
}

/** 4.4 设备改名 / 备注 */
export function updateDevice(deviceId, data) {
  return request({ url: `${BASE}/devices/${deviceId}`, method: 'patch', data });
}

/** 4.5 认领设备 */
export function claimDevice(deviceId, data) {
  return request({ url: `${BASE}/devices/${deviceId}/claim`, method: 'post', data });
}

/** 4.6 删除设备 (reset to UNCLAIMED) */
export function deleteDevice(deviceId) {
  return request({ url: `${BASE}/devices/${deviceId}`, method: 'delete' });
}

/** 4.7 遥测原始记录 (按 createdAt DESC 分页) */
export function getDeviceTelemetry(deviceId, params) {
  return request({ url: `${BASE}/devices/${deviceId}/telemetry`, method: 'get', params });
}

/** 4.2 遥测趋势 (时序聚合) */
export function getDeviceTelemetryTrends(deviceId, params) {
  return request({ url: `${BASE}/devices/${deviceId}/telemetry/trends`, method: 'get', params });
}

/** 4.3 连接日志 */
export function getDeviceConnectionLog(deviceId, params) {
  return request({ url: `${BASE}/devices/${deviceId}/connection-log`, method: 'get', params });
}

/** 4.8 设备可用命令列表 (动态表单 schema) */
export function getDeviceCommands(deviceId) {
  return request({ url: `${BASE}/devices/${deviceId}/commands`, method: 'get' });
}

// ═══════════════════════════════════════════════════════════════════
// Module 2 — Capabilities  (/api/v1/sdui/capabilities)
// ═══════════════════════════════════════════════════════════════════

/** 5.1 全局能力目录 */
export function getCapabilityCatalog() {
  return request({ url: `${BASE}/capabilities/catalog`, method: 'get' });
}

/** 5.2 设备能力详情 */
export function getDeviceCapabilities(deviceId) {
  return request({ url: `${BASE}/capabilities/${deviceId}`, method: 'get' });
}

/** 5.2 增量：设备归一化能力树 */
export function getDeviceCapabilityTree(deviceId) {
  return request({ url: `${BASE}/capabilities/${deviceId}/tree`, method: 'get' });
}

/** 5.2 增量：设备能力元数据 */
export function getDeviceCapabilityMetadata(deviceId) {
  return request({ url: `${BASE}/capabilities/${deviceId}/metadata`, method: 'get' });
}

/** 5.3 设备事件 (多级树形: category → capability → event) */
export function getDeviceCapabilityEvents(deviceId) {
  return request({ url: `${BASE}/capabilities/${deviceId}/events`, method: 'get' });
}

/** 5.4 设备 Section 类型 (含 displayFields、renderMode) */
export function getDeviceSections(deviceId) {
  return request({ url: `${BASE}/capabilities/${deviceId}/sections`, method: 'get' });
}

// ═══════════════════════════════════════════════════════════════════
// Module 3 — Debug  (/api/v1/sdui/debug)
// ═══════════════════════════════════════════════════════════════════

/** 5.5 命令执行 */
export function sendDebugCommand(deviceId, data) {
  return request({ url: `${BASE}/debug/${deviceId}/command`, method: 'post', data });
}

/** 5.6 命令 Schema (动态表单参数) */
export function getDebugCommandsSchema(deviceId) {
  return request({ url: `${BASE}/debug/${deviceId}/commands`, method: 'get' });
}

/** 5.6.1 单条命令详情 */
export function getDebugCommandDetail(deviceId, cmdId) {
  return request({ url: `${BASE}/debug/${deviceId}/commands/${cmdId}`, method: 'get' });
}

/** 5.6.2 命令历史 */
export function getDebugCommandHistory(deviceId, params) {
  return request({ url: `${BASE}/debug/${deviceId}/commands/history`, method: 'get', params });
}

/** 5.7 命令统计 */
export function getDeviceCommandStats(deviceId, params) {
  return request({ url: `${BASE}/debug/${deviceId}/command-stats`, method: 'get', params });
}

/** 5.7.1 Section 编辑器元数据 */
export function getDebugSectionEditor(deviceId) {
  return request({ url: `${BASE}/debug/${deviceId}/section-editor`, method: 'get' });
}

/** 5.8 Section 推送 (preset / custom / auto-rotate) */
export function sendDebugSection(deviceId, data) {
  return request({ url: `${BASE}/debug/${deviceId}/section`, method: 'post', data });
}

/** 5.8.1 Section patch */
export function patchDebugSection(deviceId, data) {
  return request({ url: `${BASE}/debug/${deviceId}/section/patch`, method: 'post', data });
}

/** 5.8.2 Section state */
export function getDebugSectionState(deviceId) {
  return request({ url: `${BASE}/debug/${deviceId}/section/state`, method: 'get' });
}

/** 5.8.3 清空 Section workspace */
export function clearDebugSectionState(deviceId) {
  return request({ url: `${BASE}/debug/${deviceId}/section/state`, method: 'delete' });
}

// ═══════════════════════════════════════════════════════════════════
// Preserved — Ops Overview (backed by existing backend)
// ═══════════════════════════════════════════════════════════════════

export function getOpsOverview() {
  return request({ url: `${BASE}/ops/overview`, method: 'get' });
}

export function buildSduiStreamUrl(path) {
  const baseURL = import.meta.env.VITE_BASE_API || '';
  const originBase = typeof window !== 'undefined' ? window.location.origin : '';
  return `${new URL(baseURL || '/', originBase).toString().replace(/\/$/, '')}${path}`;
}

export async function openSduiSseStream(path, { onEvent, signal, headers } = {}) {
  const token = getToken();
  const spaceId = localStorage.getItem('space_id') || '';
  const response = await axios({
    url: buildSduiStreamUrl(path),
    method: 'get',
    responseType: 'stream',
    signal,
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(spaceId ? { 'X-Space-Id': spaceId } : {}),
      ...(headers || {})
    },
    adapter: 'fetch'
  });

  const stream = response?.data;
  if (!stream?.getReader) {
    throw new Error('当前环境不支持 SSE 流读取');
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const emitChunk = (rawEvent) => {
    const lines = rawEvent.split('\n');
    let event = 'message';
    const dataLines = [];
    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    });
    const dataText = dataLines.join('\n');
    let data = dataText;
    if (dataText) {
      try {
        data = JSON.parse(dataText);
      } catch {
        data = dataText;
      }
    }
    onEvent?.({ event, data, raw: rawEvent });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    chunks
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .forEach(emitChunk);
  }
}
