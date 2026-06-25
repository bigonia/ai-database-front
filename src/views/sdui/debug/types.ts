// ═══════════════════════════════════════════════════════════
// Raw API response types (what the backend returns)
// ═══════════════════════════════════════════════════════════

export interface DebugCommandParamRaw {
  name: string;
  type: string; // string | int | float | bool | enum | object
}

export interface DebugCommandRaw {
  command: string;
  params: DebugCommandParamRaw[];
}

export interface DebugCommandCatalogRaw {
  deviceId: string;
  online: boolean;
  deviceCommands: DebugCommandRaw[];
}

// ═══════════════════════════════════════════════════════════
// Enriched types (API data + frontend registry — used in UI)
// ═══════════════════════════════════════════════════════════

export interface DebugCommandParamOption {
  label: string;
  value: string | number | boolean;
}

/** 前端注册表中的参数元数据（约束、枚举值等） */
export interface DebugCommandParamMeta {
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  enumValues?: DebugCommandParamOption[];
}

/** 合并了 API 参数与注册表元数据的完整参数定义 */
export interface DebugCommandParam {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: DebugCommandParamOption[];
}

/** 合并了 API 命令与注册表元数据的完整命令定义 */
export interface DebugCommandDefinition {
  command: string;
  displayName: string;
  group: string;
  description: string;
  params: DebugCommandParam[];
}

/** 命令目录（UI 使用） */
export interface DebugCommandCatalog {
  deviceId: string;
  online: boolean;
  deviceCommands: DebugCommandDefinition[];
}

// ═══════════════════════════════════════════════════════════
// Command execution & history
// ═══════════════════════════════════════════════════════════

export interface DebugCommandExecutionResult {
  sent: boolean;
  deviceId: string;
  command: string;
  cmdId: string;
  dispatchStatus: string;
  ackStatus: string;
  status?: string;
  validationErrors: string[];
}

export interface DebugCommandHistoryItem {
  cmdId: string;
  deviceId: string;
  command: string;
  action: string;
  phase: 'dispatch' | 'ack' | '';
  params: Record<string, unknown>;
  dispatchStatus: string;
  ackStatus: string;
  reason: string;
  createdAt: string;
  ackAt: string;
}

// ═══════════════════════════════════════════════════════════
// Command statistics
// ═══════════════════════════════════════════════════════════

export interface DebugCommandStatsSummary {
  total: number;
  acked: number;
  failed: number;
  rejected: number;
  timeout: number;
  error: number;
  successRate: number;
}

export interface DebugCommandStatsAction {
  action: string;
  total: number;
  acked: number;
  failed: number;
  successRate: number;
}

export interface DebugCommandStatsRecent {
  cmdId: string;
  action: string;
  status: string;
  reason: string | null;
  createdAt: string | null;
}

export interface DebugCommandStats {
  deviceId: string;
  summary: DebugCommandStatsSummary;
  byAction: DebugCommandStatsAction[];
  recentCommands: DebugCommandStatsRecent[];
}

// ═══════════════════════════════════════════════════════════
// Events & streaming
// ═══════════════════════════════════════════════════════════

export interface DebugEventStreamItem {
  eventId: string;
  displayName: string;
  description: string;
  eventName: string;
  ts: number | string | null;
  deviceId: string;
  category: 'physical_input' | 'media' | 'unknown';
  inputSource: {
    type?: string;
    name?: string;
    displayName?: string;
    nodeId?: string;
  } | null;
  section: {
    sectionId: string;
    pageId: string;
    sectionType: string;
    sectionDisplayName: string;
  } | null;
  value?: unknown;
  raw: Record<string, unknown>;
}

export type DebugAudioRecordPhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'processing' | 'done';

export interface DebugAudioRecordSession {
  sessionId: string;
  deviceId: string;
  type: string;
  status: string;
  startedAt: number | null;
  startedAtIso: string;
  elapsedMs: number;
  pcmBytes: number;
  chunkCount: number;
}

export interface DebugAudioRecordArtifact {
  deviceId: string;
  artifactId: string;
  type: string;
  mimeType: string;
  blobBytes: number;
  createdAt: number | null;
  createdAtIso: string;
  sttText: string;
  pcmSize: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

export interface DebugAudioRecordState {
  phase: DebugAudioRecordPhase;
  bytesReceived: number;
  chunkCount: number;
  transcript: string;
  startedAt: number | null;
  durationMs: number;
  session: DebugAudioRecordSession | null;
  artifact: DebugAudioRecordArtifact | null;
  resultVersion: number;
}

export interface DebugDeviceOption {
  deviceId: string;
  name: string;
  status: string;
  board: string;
}

export interface StreamStatusState {
  commandConnected: boolean;
  eventConnected: boolean;
}

// ═══════════════════════════════════════════════════════════
// Section debug
// ═══════════════════════════════════════════════════════════

export interface DebugSectionDisplayField {
  name: string;
  type: string;
  label: string;
  default: unknown;
  required: boolean;
  options: string[];
  min?: number;
  max?: number;
  children: DebugSectionDisplayField[];
}

export interface DebugSectionType {
  type: string;
  displayFields: DebugSectionDisplayField[];
  events: string[];
  patchOps: string[];
}

export interface DebugSectionEditor {
  deviceId: string;
  online: boolean;
  renderMode: string;
  sizeClass: string;
  layouts: string[];
  sectionTypes: DebugSectionType[];
}

export interface DebugSectionItem {
  sectionId: string;
  sectionType: string;
  fields: Record<string, unknown>;
  updatedAt?: number | null;
  draftKey?: string;
}

export interface DebugSectionPage {
  pageId: string;
  layout: string;
  autoScroll: boolean;
  autoScrollMs: number;
  sections: DebugSectionItem[];
  updatedAt?: number | null;
}

export interface DebugSectionState {
  deviceId: string;
  page: DebugSectionPage | null;
}

export interface DebugSectionPatch {
  sectionId?: string;
  op: 'add' | 'update' | 'remove';
  sectionType?: string;
  fields?: Record<string, unknown>;
}
