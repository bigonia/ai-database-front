import request from '@/utils/request';

export interface TerminalScene {
  id: string;
  type: 'agent' | 'business';
  name: string;
}
export interface SceneRuntimeStatus {
  enabled: boolean;
  agentName: string;
  navigationTrigger: string | null;
  order: string[];
  scenes: TerminalScene[];
  primaryScene: string | null;
  currentScene: string | null;
  entryMode: string | null;
  controlSessionActive: boolean;
  confirmed: boolean;
  error: string | null;
  interactionId: string | null;
  navigationTriggers: string[];
  resource: string;
}
export interface SceneConfiguration {
  enabled: boolean;
  agentName: string;
  navigationTrigger: string | null;
  order: string[];
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
export function parseSceneRuntimeStatus(value: unknown): SceneRuntimeStatus {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || typeof value.agentName !== 'string' ||
    !isNullableString(value.navigationTrigger) || !Array.isArray(value.order) || !value.order.every(item => typeof item === 'string') ||
    !Array.isArray(value.scenes) || !value.scenes.every(scene => isRecord(scene) && typeof scene.id === 'string' &&
      ['agent', 'business'].includes(String(scene.type)) && typeof scene.name === 'string') ||
    !isNullableString(value.primaryScene) || !isNullableString(value.currentScene) || !isNullableString(value.entryMode) ||
    typeof value.controlSessionActive !== 'boolean' || typeof value.confirmed !== 'boolean' || !isNullableString(value.error) ||
    !isNullableString(value.interactionId) || !Array.isArray(value.navigationTriggers) ||
    !value.navigationTriggers.every(item => typeof item === 'string') || typeof value.resource !== 'string') {
    throw new Error('页面状态响应无效');
  }
  return value as unknown as SceneRuntimeStatus;
}
const path = (deviceId: string) => `/api/v1/sdui/devices/${encodeURIComponent(deviceId)}/scene-runtime`;
const options = { timeout: 95000, sdui: { silentBusinessError: true }};
export const getSceneRuntime = (deviceId: string) => request({ ...options, url: path(deviceId), method: 'get' });
export const configureSceneRuntime = (deviceId: string, data: SceneConfiguration) => request({ ...options, url: path(deviceId), method: 'put', data });
export const enterTerminalScene = (deviceId: string, sceneId: string) => request({ ...options, url: `${path(deviceId)}/enter`, method: 'post', data: { sceneId }});
