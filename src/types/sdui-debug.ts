export interface DebugActionParameter {
  name: string;
  type: string;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  unit?: string | null;
  values?: unknown[];
}

export interface DebugActionProjection {
  name: string;
  usableIn: string[];
  usableInBinding: boolean;
  usableInRequest: boolean;
  params: DebugActionParameter[];
  description?: string | null;
  parameters?: DebugActionParameter[];
  parametersSource?: string | null;
}

export interface DebugAvailableRequests {
  deviceId: string;
  online: boolean;
  requests: DebugActionProjection[];
}

export interface DebugJournalEntry {
  requestId: string;
  name: string;
  params: Record<string, unknown>;
  ok: boolean;
  error?: string | null;
  declared: boolean;
  detail?: Record<string, unknown> | null;
  at: string;
}

export interface DebugRequestResult {
  requestId: string;
  name: string;
  ok: boolean;
  error?: string | null;
  declared: boolean;
  reachable: boolean;
  extra: Record<string, unknown>;
}

export interface DebugViewState {
  deviceId: string;
  online: boolean;
  mode: 'none' | 'section' | 'image' | 'canvas' | null;
  imageBytesReceived: number;
  canvasFramesReceived: number;
  canvasFramesRejected: number;
  imageSpec?: { width: number; height: number; paletteSize: number; expectedBytes: number } | null;
  canvasSpec?: { width: number; height: number; paletteSize: number; maxFps: number } | null;
  primaryView?: { section: Record<string, unknown>; sceneId: string | null } | null;
  screenOwnership?: {
    businessId: string;
    deploymentId: string;
    flowKey: string;
    triggerSource: string;
    triggeredAt: string;
  } | null;
}

export interface DebugBusinessConfigStatus {
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

export interface DebugTransportDiagnostics {
  deviceId: string;
  counterWindow: string;
  online: boolean;
  pendingRequests: number;
  inFlightControl: number;
  rejectedEnvelopes: number;
  droppedBinaryFrames: number;
  droppedCanvasFrames: number;
}

export interface DebugAudioDiagnostics {
  deviceId: string;
  stateWindow: string;
  online: boolean;
  stream: {
    direction: 'NONE' | 'UPLINK' | 'DOWNLINK';
    state: 'IDLE' | 'ACTIVE' | 'ABNORMAL';
    startedAt: number;
    lastDataAt: number;
    bytesReceived: number;
    endReason: string | null;
  } | null;
}

export interface DebugDiagnostics {
  business: DebugBusinessConfigStatus | null;
  transport: DebugTransportDiagnostics | null;
  audio: DebugAudioDiagnostics | null;
}
