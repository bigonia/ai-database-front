import { getCommandEntry } from './commandRegistry';
import type {
  DebugAudioRecordArtifact,
  DebugAudioRecordState,
  DebugAudioRecordSession,
  DebugCommandCatalog,
  DebugCommandCatalogRaw,
  DebugCommandDefinition,
  DebugCommandExecutionResult,
  DebugCommandHistoryItem,
  DebugCommandParam,
  DebugCommandParamOption,
  DebugCommandParamRaw,
  DebugCommandStats,
  DebugSectionDisplayField,
  DebugSectionEditor,
  DebugSectionItem,
  DebugSectionPage,
  DebugSectionPatch,
  DebugSectionState,
  DebugSectionType,
  DebugDeviceOption,
  DebugEventStreamItem
} from './types';

type UnknownRecord = Record<string, unknown>;

function asRecord(payload: unknown): UnknownRecord {
  if (typeof payload === 'object' && payload !== null) {
    return payload as UnknownRecord;
  }
  return {};
}

function unwrap<T = UnknownRecord>(payload: unknown): T {
  const record = asRecord(payload);
  return (record.data ?? record) as T;
}

// ═══════════════════════════════════════════════════════════
// Command normalization (v2 — API returns minimal data, registry supplies metadata)
// ═══════════════════════════════════════════════════════════

/** 将 API 返回的原始参数与注册表元数据合并为完整参数定义 */
function enrichParam(raw: DebugCommandParamRaw, meta?: { required?: boolean; default?: unknown; min?: number; max?: number; step?: number; enumValues?: DebugCommandParamOption[] }): DebugCommandParam {
  const label = raw.name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    name: raw.name,
    type: raw.type,
    label,
    required: meta?.required,
    default: meta?.default,
    min: meta?.min,
    max: meta?.max,
    step: meta?.step,
    options: meta?.enumValues
  };
}

/** 将 API 返回的原始命令与注册表元数据合并为完整命令定义 */
function enrichCommand(raw: { command: string; params: DebugCommandParamRaw[] }): DebugCommandDefinition {
  const entry = getCommandEntry(raw.command);
  const paramMetaMap = entry?.paramMeta ?? {};

  return {
    command: raw.command,
    displayName: entry?.displayName ?? raw.command,
    group: entry?.group ?? '其他',
    description: entry?.description ?? '',
    params: (raw.params || []).map((p) => enrichParam(p, paramMetaMap[p.name]))
  };
}

/** 3.1 解析命令目录 API 响应，合并注册表 */
export function normalizeCommandCatalog(payload: unknown): DebugCommandCatalog {
  const data = unwrap<DebugCommandCatalogRaw>(payload);
  const record = asRecord(data);
  const rawCommands = Array.isArray(record.deviceCommands)
    ? (record.deviceCommands as Array<{ command: string; params: DebugCommandParamRaw[] }>)
    : [];

  return {
    deviceId: String(record.deviceId || ''),
    online: !!record.online,
    deviceCommands: rawCommands.map(enrichCommand)
  };
}

// ═══════════════════════════════════════════════════════════
// Device options
// ═══════════════════════════════════════════════════════════

export function normalizeDeviceOptions(payload: unknown): DebugDeviceOption[] {
  const data = unwrap(payload);
  const record = asRecord(data);
  const list = Array.isArray(data) ? data : ((record.items as unknown[]) || (record.devices as unknown[]) || []);
  return list.map((item) => ({
    deviceId: String(asRecord(item).deviceId || ''),
    name: String(asRecord(item).name || asRecord(item).deviceId || ''),
    status: String(asRecord(item).status || 'OFFLINE'),
    board: String(asRecord(item).board || '')
  })).filter((item: DebugDeviceOption) => item.deviceId);
}

// ═══════════════════════════════════════════════════════════
// Command execution & history
// ═══════════════════════════════════════════════════════════

export function normalizeCommandExecution(payload: unknown, fallbackCommand = '', fallbackParams: Record<string, unknown> = {}): DebugCommandExecutionResult & { params?: Record<string, unknown> } {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    sent: !!record.sent,
    deviceId: String(record.deviceId || ''),
    command: String(record.command || fallbackCommand),
    cmdId: String(record.cmdId || `${fallbackCommand}-${Date.now()}`),
    dispatchStatus: String(record.dispatchStatus || (record.sent ? 'sent' : '')),
    ackStatus: String(record.ackStatus || record.status || 'PENDING'),
    status: String(record.status || ''),
    validationErrors: Array.isArray(record.validationErrors) ? (record.validationErrors as string[]) : [],
    params: Object.keys(asRecord(record.params)).length ? (record.params as Record<string, unknown>) : fallbackParams
  };
}

export function normalizeCommandHistoryItem(item: unknown): DebugCommandHistoryItem {
  const record = asRecord(item);
  const phase = record.phase === 'dispatch' || record.phase === 'ack' ? record.phase : '';
  const status = String(record.status || '');
  const statusIsDispatch = ['SENT', 'FAILED'].includes(status);
  const statusIsAck = ['ACKED', 'REJECTED', 'TIMEOUT', 'ERROR', 'VALIDATION_FAILED'].includes(status);
  return {
    cmdId: String(record.cmdId || record.id || `${record.command || record.action || 'cmd'}-${Date.now()}`),
    deviceId: String(record.deviceId || ''),
    command: String(record.command || record.action || ''),
    action: String(record.action || record.runtimeHandler || record.command || ''),
    phase,
    params: asRecord(record.params || record.payload),
    dispatchStatus: String(record.dispatchStatus || (phase === 'dispatch' || statusIsDispatch ? status : '') || (record.sent ? 'SENT' : '')),
    ackStatus: String(record.ackStatus || (phase === 'ack' || statusIsAck ? status : '') || 'PENDING'),
    reason: String(record.reason || ''),
    createdAt: String(record.createdAt || record.time || ''),
    ackAt: String(record.ackAt || '')
  };
}

export function normalizeCommandHistory(payload: unknown): DebugCommandHistoryItem[] {
  const data = unwrap(payload);
  const record = asRecord(data);
  const list = Array.isArray(data) ? data : ((record.history as unknown[]) || (record.items as unknown[]) || (record.commands as unknown[]) || []);
  const merged = new Map<string, DebugCommandHistoryItem>();
  list.map(normalizeCommandHistoryItem).forEach((item) => {
    const current = merged.get(item.cmdId);
    if (!current) {
      merged.set(item.cmdId, item);
      return;
    }
    merged.set(item.cmdId, {
      ...current,
      ...item,
      action: item.action || current.action,
      phase: item.phase || current.phase,
      params: Object.keys(item.params).length ? item.params : current.params,
      dispatchStatus: item.dispatchStatus || current.dispatchStatus,
      ackStatus: item.ackStatus !== 'PENDING' || !current.ackStatus ? item.ackStatus : current.ackStatus,
      reason: item.reason || current.reason,
      createdAt: item.createdAt || current.createdAt,
      ackAt: item.ackAt || current.ackAt
    });
  });
  return Array.from(merged.values());
}

export function normalizeCommandStats(payload: unknown): DebugCommandStats {
  const data = unwrap(payload);
  const record = asRecord(data);
  const summary = asRecord(record.summary);
  return {
    deviceId: String(record.deviceId || ''),
    summary: {
      total: Number(summary.total || 0),
      acked: Number(summary.acked || 0),
      failed: Number(summary.failed || 0),
      rejected: Number(summary.rejected || 0),
      timeout: Number(summary.timeout || 0),
      error: Number(summary.error || 0),
      successRate: Number(summary.successRate || 0)
    },
    byAction: Array.isArray(record.byAction) ? (record.byAction as DebugCommandStats['byAction']) : [],
    recentCommands: Array.isArray(record.recentCommands) ? (record.recentCommands as DebugCommandStats['recentCommands']) : []
  };
}

export function normalizeEventItem(eventName: string, payload: unknown): DebugEventStreamItem {
  const record = asRecord(payload);
  const raw = asRecord(record.raw);
  const inputSourceRecord = asRecord(record.inputSource);
  const sectionRecord = asRecord(record.section);
  const normalizedEventName = String(raw.eventName || record.eventName || eventName || record.eventId || 'input_event');
  return {
    eventId: String(record.eventId || normalizedEventName),
    displayName: String(record.displayName || normalizedEventName),
    description: String(record.description || record.displayName || normalizedEventName),
    eventName: normalizedEventName,
    ts: (record.ts as number | string | null) || null,
    deviceId: String(record.deviceId || ''),
    category: ['physical_input', 'media', 'unknown'].includes(String(record.category))
      ? String(record.category) as DebugEventStreamItem['category']
      : 'unknown',
    inputSource: Object.keys(inputSourceRecord).length
      ? {
        type: inputSourceRecord.type == null ? undefined : String(inputSourceRecord.type),
        name: inputSourceRecord.name == null ? undefined : String(inputSourceRecord.name),
        displayName: inputSourceRecord.displayName == null ? undefined : String(inputSourceRecord.displayName),
        nodeId: inputSourceRecord.nodeId == null ? undefined : String(inputSourceRecord.nodeId)
      }
      : null,
    section: Object.keys(sectionRecord).length
      ? {
        sectionId: String(sectionRecord.sectionId || ''),
        pageId: String(sectionRecord.pageId || ''),
        sectionType: String(sectionRecord.sectionType || ''),
        sectionDisplayName: String(sectionRecord.sectionDisplayName || sectionRecord.sectionType || '')
      }
      : null,
    ...(Object.prototype.hasOwnProperty.call(record, 'value') ? { value: record.value } : {}),
    raw
  };
}

export function createInitialAudioRecordState(): DebugAudioRecordState {
  return {
    phase: 'idle',
    bytesReceived: 0,
    chunkCount: 0,
    transcript: '',
    startedAt: null,
    durationMs: 0,
    session: null,
    artifact: null,
    resultVersion: 0
  };
}

function toNumber(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function firstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function firstString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function reduceAudioRecordState(
  current: DebugAudioRecordState,
  event: DebugEventStreamItem
): DebugAudioRecordState {
  const record = typeof event.raw === 'object' && event.raw !== null ? asRecord(event.raw) : {};
  const bytesReceived = firstNumber(record, [
    'bytesReceived',
    'receivedBytes',
    'totalBytes',
    'pcmBytes',
    'size',
    'byteLength'
  ]);
  const chunkCount = firstNumber(record, ['chunkCount', 'chunks', 'chunkIndex']);
  const transcript = firstString(record, ['text', 'transcript', 'result', 'recognitionText']);

  if (event.eventName === 'audio.record.started') {
    return {
      phase: 'recording',
      bytesReceived: 0,
      chunkCount: 0,
      transcript: '',
      startedAt: firstNumber(record, ['startedAt']) ?? Date.now(),
      durationMs: 0,
      session: {
        sessionId: 'audio-record',
        deviceId: current.session?.deviceId || '',
        type: 'audio.record',
        status: 'active',
        startedAt: firstNumber(record, ['startedAt']) ?? Date.now(),
        startedAtIso: firstString(record, ['startedAtIso']),
        elapsedMs: 0,
        pcmBytes: 0,
        chunkCount: 0
      },
      artifact: null,
      resultVersion: current.resultVersion
    };
  }

  if (event.eventName === 'audio.record.chunk') {
    return {
      ...current,
      phase: 'recording',
      bytesReceived: bytesReceived ?? current.bytesReceived,
      chunkCount: chunkCount ?? current.chunkCount,
      session: current.session
        ? {
          ...current.session,
          pcmBytes: bytesReceived ?? current.session.pcmBytes,
          chunkCount: chunkCount ?? current.session.chunkCount
        }
        : current.session
    };
  }

  if (event.eventName === 'audio.record.data') {
    return {
      ...current,
      phase: 'processing',
      bytesReceived: bytesReceived ?? current.bytesReceived,
      chunkCount: chunkCount ?? current.chunkCount,
      durationMs: firstNumber(record, ['durationMs']) ?? current.durationMs,
      session: null
    };
  }

  if (event.eventName === 'audio.stt.processing') {
    return {
      ...current,
      phase: 'processing',
      bytesReceived: bytesReceived ?? current.bytesReceived,
      chunkCount: chunkCount ?? current.chunkCount
    };
  }

  if (event.eventName === 'audio.stt.result') {
    return {
      ...current,
      phase: 'done',
      transcript: transcript || current.transcript,
      resultVersion: Date.now()
    };
  }

  return current;
}

export function normalizeAudioRecordSession(payload: unknown): DebugAudioRecordSession {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    sessionId: String(record.sessionId || 'audio-record'),
    deviceId: String(record.deviceId || ''),
    type: String(record.type || 'audio.record'),
    status: String(record.status || 'active'),
    startedAt: firstNumber(record, ['startedAt']),
    startedAtIso: String(record.startedAtIso || ''),
    elapsedMs: Number(record.elapsedMs || 0),
    pcmBytes: Number(record.pcmBytes || 0),
    chunkCount: Number(record.chunkCount || 0)
  };
}

export function normalizeAudioRecordArtifact(payload: unknown): DebugAudioRecordArtifact {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    deviceId: String(record.deviceId || ''),
    artifactId: String(record.artifactId || 'audio-record-latest'),
    type: String(record.type || 'audio/recording'),
    mimeType: String(record.mimeType || 'audio/wav'),
    blobBytes: Number(record.blobBytes || 0),
    createdAt: firstNumber(record, ['createdAt']),
    createdAtIso: String(record.createdAtIso || ''),
    sttText: String(record.sttText || ''),
    pcmSize: Number(record.pcmSize || 0),
    sampleRate: Number(record.sampleRate || 0),
    channels: Number(record.channels || 0),
    bitsPerSample: Number(record.bitsPerSample || 0),
    durationMs: Number(record.durationMs || 0)
  };
}

export function applyAudioRecordSession(
  current: DebugAudioRecordState,
  session: DebugAudioRecordSession | null
): DebugAudioRecordState {
  if (!session) {
    if (current.phase === 'recording' || current.phase === 'starting' || current.phase === 'stopping') {
      return {
        ...current,
        phase: 'idle',
        session: null
      };
    }
    return {
      ...current,
      session: null
    };
  }

  return {
    ...current,
    phase: 'recording',
    bytesReceived: session.pcmBytes || current.bytesReceived,
    chunkCount: session.chunkCount || current.chunkCount,
    startedAt: session.startedAt,
    durationMs: session.elapsedMs || current.durationMs,
    session,
    artifact: null
  };
}

export function applyAudioRecordArtifact(
  current: DebugAudioRecordState,
  artifact: DebugAudioRecordArtifact | null
): DebugAudioRecordState {
  if (!artifact) {
    return {
      ...current,
      artifact: null
    };
  }

  return {
    ...current,
    phase: 'done',
    bytesReceived: artifact.pcmSize || current.bytesReceived,
    chunkCount: current.chunkCount,
    transcript: artifact.sttText || current.transcript,
    startedAt: current.startedAt,
    durationMs: artifact.durationMs || current.durationMs,
    session: null,
    artifact,
    resultVersion: Date.now()
  };
}

// ═══════════════════════════════════════════════════════════
// Section debug normalization
// ═══════════════════════════════════════════════════════════

function normalizeDisplayField(item: unknown): DebugSectionDisplayField {
  const record = asRecord(item);
  return {
    name: String(record.name || ''),
    type: String(record.type || 'string'),
    label: String(record.label || record.name || ''),
    default: record.default,
    required: Boolean(record.required),
    options: Array.isArray(record.options) ? (record.options as string[]).map(String) : [],
    min: record.min != null ? Number(record.min) : undefined,
    max: record.max != null ? Number(record.max) : undefined,
    children: Array.isArray(record.children) ? (record.children as unknown[]).map(normalizeDisplayField) : []
  };
}

function normalizeSectionType(item: unknown): DebugSectionType {
  const record = asRecord(item);
  return {
    type: String(record.type || ''),
    displayFields: Array.isArray(record.displayFields) ? (record.displayFields as unknown[]).map(normalizeDisplayField) : [],
    events: Array.isArray(record.events) ? (record.events as string[]) : [],
    patchOps: Array.isArray(record.patchOps) ? (record.patchOps as string[]) : []
  };
}

export function normalizeSectionEditor(payload: unknown): DebugSectionEditor {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    deviceId: String(record.deviceId || ''),
    online: !!record.online,
    renderMode: String(record.renderMode || 'rich'),
    sizeClass: String(record.sizeClass || 'unknown'),
    layouts: Array.isArray(record.layouts) ? (record.layouts as string[]) : [],
    sectionTypes: Array.isArray(record.sectionTypes) ? (record.sectionTypes as unknown[]).map(normalizeSectionType) : []
  };
}

function normalizeSectionItem(item: unknown): DebugSectionItem {
  const record = asRecord(item);
  return {
    sectionId: String(record.sectionId || ''),
    sectionType: String(record.sectionType || ''),
    fields: asRecord(record.fields),
    updatedAt: record.updatedAt == null ? null : Number(record.updatedAt),
    draftKey: createDraftKey(String(record.sectionId || 'section'))
  };
}

function normalizeSectionPage(item: unknown): DebugSectionPage {
  const record = asRecord(item);
  return {
    pageId: String(record.pageId || ''),
    layout: String(record.layout || 'vertical_scroll'),
    autoScroll: !!record.autoScroll,
    autoScrollMs: Number(record.autoScrollMs || 0),
    sections: Array.isArray(record.sections) ? (record.sections as unknown[]).map(normalizeSectionItem) : [],
    updatedAt: record.updatedAt == null ? null : Number(record.updatedAt)
  };
}

export function normalizeSectionState(payload: unknown): DebugSectionState {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    deviceId: String(record.deviceId || ''),
    page: record.page == null ? null : normalizeSectionPage(record.page)
  };
}

export function cloneSectionPage(page: DebugSectionPage | null | undefined): DebugSectionPage {
  if (!page) {
    return {
      pageId: '',
      layout: 'vertical_scroll',
      autoScroll: false,
      autoScrollMs: 0,
      sections: []
    };
  }

  return {
    pageId: page.pageId,
    layout: page.layout,
    autoScroll: page.autoScroll,
    autoScrollMs: page.autoScrollMs,
    sections: page.sections.map((section) => ({
      sectionId: section.sectionId,
      sectionType: section.sectionType,
      fields: JSON.parse(JSON.stringify(section.fields || {})),
      updatedAt: section.updatedAt ?? null,
      draftKey: section.draftKey || createDraftKey(section.sectionId || 'section')
    })),
    updatedAt: page.updatedAt ?? null
  };
}

export function buildSingleSectionPatch(section: DebugSectionItem, op: DebugSectionPatch['op']): DebugSectionPatch {
  if (op === 'remove') {
    return {
      sectionId: section.sectionId,
      op
    };
  }

  return {
    ...(section.sectionId ? { sectionId: section.sectionId } : {}),
    op,
    ...(op === 'add' ? { sectionType: section.sectionType } : {}),
    fields: JSON.parse(JSON.stringify(section.fields || {}))
  };
}

export function createDraftKey(seed = 'draft') {
  return `${seed}_${Math.random().toString(36).slice(2, 10)}`;
}

// ═══════════════════════════════════════════════════════════
// Command grouping (by registry "group" field)
// ═══════════════════════════════════════════════════════════

export function groupCommandsByGroup(items: DebugCommandDefinition[]) {
  const groups = new Map<string, DebugCommandDefinition[]>();
  items.forEach((item) => {
    const key = item.group || '其他';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(item);
  });
  return Array.from(groups.entries()).map(([name, commands]) => ({ name, commands }));
}

// Keep old name as alias for backward compat
export const groupCommandsByCapability = groupCommandsByGroup;
