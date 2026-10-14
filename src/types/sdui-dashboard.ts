// ── SDUI TypeScript 类型定义 ──
// 基于 FRONTEND_API.md v2.0

// ── 通用响应 ──
export interface ApiResponse<T> {
  code: number; // 20000 = success
  data: T;
  message: string;
}

// ── 设备状态 / 注册状态 ──
export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type RegistrationStatus = 'UNCLAIMED' | 'CLAIMED';

// ── 3.1 设备卡片列表项 ──
export interface SduiDevice {
  deviceId: string;
  name: string | null;
  status: DeviceStatus;
  registrationStatus: RegistrationStatus;
  board: string | null;
  capabilitySyncState: string | null;
  lastTelemetry: TelemetrySnapshot | null;
  lastSeenAt: string | null;
  connectedAt: string | null;
  connectionCount: number | null;
  claimedAt: string | null;
  createdAt: string | null;
}

// ── 3.1 设备列表响应 ──
export interface SduiDeviceListResponse {
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  page: number;
  size: number;
  items: SduiDevice[];
}

// ── 4.1 设备详情 ──
export interface SduiDeviceDetailResponse {
  deviceId: string;
  name: string | null;
  notes: string | null;
  status: DeviceStatus;
  registrationStatus: RegistrationStatus;
  board: string;
  protocolVersion: string | null;
  schemaVersion: string | null;
  capabilityHash: string | null;
  capabilitySyncState: string | null;
  businessAllowed: boolean;
  capabilitySummary: {
    deviceId: string;
    online: boolean;
    syncState: string;
    commandSchemaHash: string | null;
    uiSchemaHash: string | null;
    schemaSynced: boolean;
    board: string | null;
    protocolVersion: string | null;
    schemaVersion: string | null;
    actionCount: number;
    triggerCount: number;
    surface: DeviceSurface | null;
  } | null;
  surface: DeviceSurface | null;
  lastTelemetry: TelemetrySnapshot | null;
  connectedAt: string | null;
  sessionId: string | null;
  connectionCount: number | null;
  totalUptimeS: number | null;
  lastSeenAt: string | null;
  claimedAt: string | null;
  createdAt: string | null;
}

export interface DeviceSurface {
  screen: { width: number; height: number; touch: boolean } | null;
  ui: { sectionTypes: string[] | null; viewModes: string[] | null; menuNativeInput: Record<string, string> } | null;
  image: { maxBytes: number | null; maxPaletteColors: number | null } | null;
  canvas: { resolutions: string[]; colorBits: number[]; maxFps: number | null } | null;
  audio: { formats: string[]; sampleRate: number | null; maxBufferBytes: number | null } | null;
}

// ── 遥测快照 (9.1) ──
export interface TelemetrySnapshot {
  wifi: { rssi: number | null; ip: string | null };
  memory: {
    freeHeapInternal: number | null;
    largestHeapInternal: number | null;
    freeHeapDma: number | null;
    largestHeapDma: number | null;
    freeHeapPsram: number | null;
    largestHeapPsram: number | null;
    freeHeapTotal: number | null;
    fragInternalPct: number | null;
    fragDmaPct: number | null;
    fragPsramPct: number | null;
  };
  temperature: { celsius: number | null };
  power: {
    supported: boolean | null;
    batteryMv: number | null;
    batteryPct: number | null;
    charging: boolean | null;
    extPowerPresent: boolean | null;
    extPowerCtrl: boolean | null;
    extPowerOn: boolean | null;
  };
  uptimeS: number | null;
  lastHeartbeatAt: string | null;
}

// ── 4.2 趋势 ──
export interface TrendPoint {
  ts: string | null;
  avg: number | null;
  min?: number | null;
  max?: number | null;
}

export interface TrendSeries {
  deviceId: string;
  range: string;
  bucket: string;
  pointCount: number;
  series: {
    memory?: {
      freeHeapTotal: TrendPoint[];
      freeHeapInternal: TrendPoint[];
      fragInternalPct: TrendPoint[];
    };
    temperature?: { celsius: TrendPoint[] };
    wifi?: { rssi: TrendPoint[] };
    battery?: { batteryPct: TrendPoint[]; batteryMv: TrendPoint[] };
    power?: { batteryPct: TrendPoint[]; batteryMv: TrendPoint[] };
  };
}

// ── 4.3 连接日志 ──
export interface ConnectionLog {
  deviceId: string;
  currentSession: {
    connectedAt: string | null;
    sessionId: string | null;
    durationS: number | null;
  } | null;
  stats: {
    totalConnections: number;
    totalDisconnections: number;
    disconnectReasons: Record<string, number>;
  } | null;
  events: Array<{
    eventType: 'CONNECTED' | 'DISCONNECTED';
    sessionId: string | null;
    ipAddress: string | null;
    disconnectReason: string | null;
    eventAt: string | null;
  }>;
  page: number;
  size: number;
  totalEvents: number;
}
