// ── SDUI TypeScript 类型定义 ──
// 基于 FRONTEND_API.md v2.0

// ── 通用响应 ──
interface ApiResponse<T> {
  code: number; // 20000 = success
  data: T;
  message: string;
}

// ── 设备状态 / 注册状态 ──
type DeviceStatus = 'ONLINE' | 'OFFLINE';
type RegistrationStatus = 'UNCLAIMED' | 'CLAIMED';

// ── 3.1 设备卡片列表项 ──
interface SduiDevice {
  deviceId: string;
  name: string;
  status: DeviceStatus;
  registrationStatus: RegistrationStatus;
  board: string;
  screenShape: string;
  inputMode: string;
  sizeClass: string;
  lastTelemetry: TelemetrySnapshot | null;
  currentAppId: string | null;
  lastSeenAt: string | null;
  connectedAt: string | null;
  connectionCount: number | null;
  claimedAt: string | null;
  createdAt: string | null;
}

// ── 3.1 设备列表响应 ──
interface SduiDeviceListResponse {
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  page: number;
  size: number;
  items: SduiDevice[];
}

// ── 3.3 设备类型 ──
interface DeviceTypeInfo {
  key: string;
  board: string;
  label: string;
  labelSource: string;
  hasVariants: boolean;
  inputEvents: string[];
  outputCommands: string[];
  sectionTypes: string[];
  deviceCount: number;
  onlineCount: number;
  exampleDeviceIds: string[];
  lastSeen: string | null;
}

interface DeviceTypesResponse {
  types: DeviceTypeInfo[];
  totalCount: number;
}

// ── 4.1 设备详情 ──
interface SduiDeviceDetailResponse {
  deviceId: string;
  name: string;
  notes: string;
  status: DeviceStatus;
  registrationStatus: RegistrationStatus;
  board: string;
  screenShape: string;
  screenWidth: number;
  screenHeight: number;
  inputMode: string;
  sizeClass: string;
  availableCommands: string[];
  capabilitiesSnapshot: string;
  capabilitiesSummary: {
    board: string;
    screen: { w: number; h: number; shape: string };
    inputMode: string;
    sizeClass: string;
    renderMode: string;
  };
  recentCommands: Array<{
    cmdId: string;
    action: string;
    status: string;
    reason: string | null;
    createdAt: string | null;
  }>;
  lastTelemetry: TelemetrySnapshot;
  connectedAt: string | null;
  sessionId: string | null;
  connectionCount: number | null;
  totalUptimeS: number | null;
  lastSeenAt: string | null;
  claimedAt: string | null;
  createdAt: string | null;
}

// ── 遥测快照 (9.1) ──
interface TelemetrySnapshot {
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
    supported: boolean;
    batteryMv: number | null;
    batteryPct: number | null;
    charging: boolean;
    extPowerPresent: boolean;
    extPowerCtrl: boolean;
    extPowerOn: boolean;
  };
  uptimeS: number | null;
  lastHeartbeatAt: string | null;
}

// ── 4.2 趋势 ──
interface TrendPoint {
  ts: string;
  avg: number;
  min?: number;
  max?: number;
}

interface TrendSeries {
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
interface ConnectionLog {
  deviceId: string;
  currentSession: {
    connectedAt: string | null;
    sessionId: string | null;
    durationS: number | null;
  };
  stats: {
    totalConnections: number;
    totalDisconnections: number;
    disconnectReasons: Record<string, number>;
  };
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

// ── 5.1 能力目录 ──
interface CapabilityCatalogStats {
  devicesTracked: number;
  knownEvents: number;
  knownCommands: number;
  knownSectionTypes: number;
  deviceTypes: number;
}

interface CapabilityEventLeaf {
  eventId: string;
  direction: string;
  category: string;
  displayName: string;
  description: string;
  sourceCapability: string;
  transport: string;
  payloadSchema: Array<{ name: string; type: string; required: boolean; description: string }>;
  parentEventId: string;
}

interface CapabilityCommandLeaf {
  commandId: string;
  displayName: string;
  description: string;
  sourceCapability: string;
  payloadSchema: Array<{ name: string; type: string; required: boolean; description: string }>;
}

interface CapabilityCategory {
  category: string;
  label: string;
  capabilities: Array<{
    capability: string;
    label: string;
    events?: CapabilityEventLeaf[];
    commands?: CapabilityCommandLeaf[];
    sections?: SectionTypeInfo[];
    layouts?: Array<{ name: string; description?: string }>;
  }>;
}

interface CapabilityModule {
  module: string;
  label: string;
  description: string;
  groups: CapabilityCategory[];
}

interface CapabilityCatalogResponse {
  stats: CapabilityCatalogStats;
  modules: CapabilityModule[];
}

// ── 5.2 设备能力 ──
interface DeviceCapabilitiesResponse {
  deviceId: string;
  status: string;
  online: boolean;
  reportedAt: string;
  renderMode: 'rich' | 'compact';
  deviceCapabilities: {
    inputEvents: string[];
    outputCommands: string[];
    sectionTypes: string[];
    deviceProfile: {
      shape: string;
      screenW: number;
      screenH: number;
      inputMode: string;
      sizeClass: string;
    };
  };
  globalCatalog: {
    events: CapabilityEventLeaf[];
    commands: CapabilityCommandLeaf[];
    sectionTypes: SectionTypeInfo[];
  };
  sectionInteractionEvents: Record<string, string[]>;
  unsupportedCapabilities: {
    events: string[];
    commands: string[];
    sectionTypes: string[];
  };
}

// ── 5.3 事件树 ──
interface CapabilityEventsResponse {
  deviceId: string;
  online: boolean;
  inboundEventTree: CapabilityCategory[];
  allEventIds: string[];
  reportedAt: string;
}

// ── 5.4 Section 类型 ──
interface SectionTypeInfo {
  type: string;
  displayName: string;
  interactive: boolean;
  displayFields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
  }>;
  interactionEvents: string[];
  deviceSupported: boolean;
}

interface DeviceSectionsResponse {
  deviceId: string;
  online: boolean;
  renderMode: 'rich' | 'compact';
  sectionTypes: SectionTypeInfo[];
}

// ── 5.5/5.6 命令 ──
interface CommandSchema {
  command: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    min?: number;
    max?: number;
    options?: string[];
  }>;
  serverSideProcessing: boolean;
}

interface DeviceCommandsResponse {
  deviceId: string;
  online: boolean;
  commands: CommandSchema[];
}

interface CommandResult {
  sent: boolean;
  deviceId: string;
  command: string;
  cmdId: string;
  status: string;
  transcription?: string;
  validationErrors?: string[];
}

// ── 5.7 命令统计 ──
interface CommandStats {
  deviceId: string;
  summary: {
    total: number;
    acked: number;
    failed: number;
    rejected: number;
    timeout: number;
    error: number;
    successRate: number;
  };
  byAction: Array<{
    action: string;
    total: number;
    acked: number;
    failed: number;
    successRate: number;
  }>;
  recentCommands: Array<{
    cmdId: string;
    action: string;
    status: string;
    reason: string | null;
    createdAt: string | null;
  }>;
}

// ── 5.9 Section 预设 ──
interface SectionPreset {
  name: string;
  label: string;
  description: string;
  layout: string;
  sectionCount: number;
  sectionTypes: string[];
}

interface IncompatiblePreset extends SectionPreset {
  compatible: false;
  missingSectionTypes: string[];
}

interface DeviceSectionPresetsResponse {
  deviceId: string;
  presets: SectionPreset[];
  incompatiblePresets: IncompatiblePreset[];
  availableLayouts: string[];
}

// ── 运维概览 (preserved, not in spec) ──
interface OpsOverview {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  claimedDevices: number;
  unclaimedDevices: number;
  healthSummary: Record<string, number>;
  commandSummary: {
    sentCommands: number;
    failedCommands: number;
    ackedCommands: number;
    rejectedCommands: number;
    errorCommands: number;
    timeoutCommands: number;
    overallSuccessRate: number;
  };
  boardDistribution: Record<string, number>;
  avgHealthScore: number;
  devicesNeedingAttention: Array<{
    deviceId: string;
    name: string;
    status: string;
    healthLevel: string;
    healthScore: number | null;
    warnings: string[];
  }>;
}
