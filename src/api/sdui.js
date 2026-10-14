import sduiRequest from '@/api/sdui-request';
import axios from 'axios';
import { getToken } from '@/utils/auth';
import { handleRequestError } from '@/utils/request';

const BASE = '/api/v1/sdui';
// Device inventory and telemetry
export const getDeviceList = (params) => sduiRequest({ url: `${BASE}/devices`, method: 'get', params });
export const getUnclaimedDevices = (params = {}) => sduiRequest({ url: `${BASE}/devices`, method: 'get', params: { page: 0, size: 12, registrationStatus: 'UNCLAIMED', ...params }});
export const getDeviceDetail = (deviceId) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}`, method: 'get' });
export const getDeviceCapabilitySchema = (deviceId) => sduiRequest({ url: `${BASE}/capabilities/${encodeURIComponent(deviceId)}/schema`, method: 'get' });
export const updateDevice = (deviceId, data) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}`, method: 'patch', data });
export const claimDevice = (deviceId, data) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/claim`, method: 'post', data });
export const deleteDevice = (deviceId) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}`, method: 'delete' });
export const getDeviceTelemetry = (deviceId, params) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/telemetry`, method: 'get', params });
export const getDeviceTelemetryTrends = (deviceId, params) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/telemetry/trends`, method: 'get', params });
export const getDeviceConnectionLog = (deviceId, params) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/connection-log`, method: 'get', params });
// V2 device debugging
export const getDebugAvailableRequests = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/requests`, method: 'get' });
export const getDebugRequestHistory = (deviceId, limit = 20) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/requests/history`, method: 'get', params: { limit }});
export const getDebugRequestDetail = (deviceId, requestId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/requests/${encodeURIComponent(requestId)}`, method: 'get' });
export const sendDebugRequest = (deviceId, data) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/request`, method: 'post', data }, { timeout: 120000 });
export const publishDebugView = (deviceId, data) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/view`, method: 'post', data }, { timeout: 60000 });
export const getDebugViewState = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/view/state`, method: 'get' });
export const republishDebugView = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/view/republish`, method: 'post' }, { timeout: 60000 });
export const clearDebugViewState = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/view/state`, method: 'delete' });
export const getDebugBusinessStatus = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/business/config-status`, method: 'get' });
export const getDebugTransportDiagnostics = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/transport/diagnostics`, method: 'get' });
export const getDebugAudioState = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/audio/state`, method: 'get' });
export const getLatestRecording = (deviceId) => sduiRequest({ url: `${BASE}/devices/${encodeURIComponent(deviceId)}/artifacts/latest`, method: 'get', params: { type: 'audio/recording' }});
export const getArtifactBlob = async (artifactId) => {
  const token = getToken();
  const response = await axios({ url: streamUrl(`${BASE}/artifacts/${encodeURIComponent(artifactId)}/blob`), method: 'get', responseType: 'blob', headers: token ? { Authorization: `Bearer ${token}` } : {}});
  return response.data;
};
export const sendDebugTts = (deviceId, text) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/audio/tts`, method: 'post', data: { text }}, { timeout: 120000 });
export const sendDebugTestTone = (deviceId, tone) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/audio/tone/${encodeURIComponent(tone)}`, method: 'post' }, { timeout: 120000 });
export const sendDebugAudio = async (deviceId, pcm) => {
  const token = getToken();
  const response = await axios({ url: streamUrl(`${BASE}/debug/${encodeURIComponent(deviceId)}/audio/downlink`), method: 'post', data: pcm, timeout: 120000,
    headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }});
  if (response.data?.code !== 20000) throw new Error(response.data?.message || '音频播放失败');
  return response.data.data;
};
export const sendDebugViewFrame = async (deviceId, frame) => {
  const token = getToken();
  try {
    const response = await axios({
      url: streamUrl(`${BASE}/debug/${encodeURIComponent(deviceId)}/view/frame`),
      method: 'post',
      data: frame,
      timeout: 60000,
      headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const result = response?.data;
    if (result?.code !== 20000) throw new Error(result?.message || '帧提交失败');
    return result.data;
  } catch (cause) {
    if (axios.isAxiosError(cause)) handleRequestError(cause, { notify: false });
    throw cause;
  }
};
export const completeDebugView = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/view/complete`, method: 'post' }, { timeout: 60000 });

function streamUrl(path) {
  const baseURL = import.meta.env.VITE_BASE_API || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${new URL(baseURL || '/', origin).toString().replace(/\/$/, '')}${path}`;
}

export const getDebugRecordingResult = (deviceId) => sduiRequest({ url: `${BASE}/debug/${encodeURIComponent(deviceId)}/audio/recording/result`, method: 'post' }, { timeout: 120000 });
