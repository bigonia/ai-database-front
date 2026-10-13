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
const path = (deviceId: string) => `/api/v1/sdui/devices/${encodeURIComponent(deviceId)}/scene-runtime`;
const options = { timeout: 95000, sdui: { silentBusinessError: true } };
export const getSceneRuntime = (deviceId: string) => request({ ...options, url: path(deviceId), method: 'get' });
export const configureSceneRuntime = (deviceId: string, data: SceneConfiguration) => request({ ...options, url: path(deviceId), method: 'put', data });
export const enterTerminalScene = (deviceId: string, sceneId: string) => request({ ...options, url: `${path(deviceId)}/enter`, method: 'post', data: { sceneId } });
