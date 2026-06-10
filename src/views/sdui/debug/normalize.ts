import { getCommandEntry } from './commandRegistry';
import type {
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
  DebugSectionPreviewEvent,
  DebugSectionType,
  DebugSectionWorkspaceState,
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
    status: String(asRecord(item).status || 'OFFLINE')
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
  return {
    cmdId: String(record.cmdId || record.id || `${record.command || record.action || 'cmd'}-${Date.now()}`),
    deviceId: String(record.deviceId || ''),
    command: String(record.command || record.action || ''),
    action: String(record.action || record.runtimeHandler || record.command || ''),
    params: asRecord(record.params || record.payload),
    dispatchStatus: String(record.dispatchStatus || (record.sent ? 'sent' : '')),
    ackStatus: String(record.ackStatus || record.status || 'PENDING'),
    reason: String(record.reason || ''),
    createdAt: String(record.createdAt || record.time || new Date().toISOString()),
    ackAt: String(record.ackAt || '')
  };
}

export function normalizeCommandHistory(payload: unknown): DebugCommandHistoryItem[] {
  const data = unwrap(payload);
  const record = asRecord(data);
  const list = Array.isArray(data) ? data : ((record.history as unknown[]) || (record.items as unknown[]) || (record.commands as unknown[]) || []);
  return list.map(normalizeCommandHistoryItem);
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
  const raw = typeof payload === 'object' && payload !== null ? payload : { value: payload };
  const record = asRecord(raw);
  return {
    eventName: eventName || String(record.event || 'input_event'),
    ts: (record.ts as number | string | null) || (record.createdAt as string) || (record.time as string) || null,
    nodeId: String(record.nodeId || ''),
    raw
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

export function normalizeSectionWorkspaceState(payload: unknown): DebugSectionWorkspaceState {
  const data = unwrap(payload);
  const record = asRecord(data);
  return {
    deviceId: String(record.deviceId || ''),
    online: !!record.online,
    activePageId: record.activePageId == null || record.activePageId === '' ? null : String(record.activePageId),
    pages: Array.isArray(record.pages) ? (record.pages as unknown[]).map(normalizeSectionPage) : []
  };
}

export function normalizeSectionPreviewEvent(
  eventName: string,
  pageId: string,
  sectionId: string,
  payload: Record<string, unknown> = {}
): DebugSectionPreviewEvent {
  return {
    eventName,
    pageId,
    sectionId,
    payload,
    createdAt: new Date().toISOString()
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
