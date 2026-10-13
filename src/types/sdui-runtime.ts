export interface SduiRuntimeViewState {
  deviceId: string;
  online: boolean;
  mode: 'none' | 'section' | 'image' | 'canvas' | null;
  imageBytesReceived: number;
  canvasFramesReceived: number;
  canvasFramesRejected: number;
  imageSpec: { width: number; height: number; paletteSize: number; expectedBytes: number } | null;
  canvasSpec: { width: number; height: number; paletteSize: number; maxFps: number } | null;
  primaryView: { section: Record<string, unknown>; sceneId: string | null } | null;
  screenOwnership: {
    businessId: string;
    deploymentId: string;
    flowKey: string;
    triggerSource: string;
    triggeredAt: string;
  } | null;
}

export interface SduiBusinessConfigStatus {
  deviceId: string;
  online: boolean;
  active: boolean;
  primaryInstanceId: string | null;
  instanceCount: number;
  appliedAt: string | null;
  confirmedByDevice: boolean | null;
  sceneCount: number;
  bindingCount: number;
  sceneIds: string[];
}
