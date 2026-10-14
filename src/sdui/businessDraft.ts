import type { BusinessDefinition, BusinessEditorResources } from '@/types/sdui-business';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function definitionSnapshot(value: BusinessDefinition): BusinessDefinition {
  return JSON.parse(JSON.stringify(value)) as BusinessDefinition;
}

export function parseBusinessPayload(value: unknown, expectedBusinessId: string): {
  revision: number;
  definition: BusinessDefinition;
} {
  if (!isRecord(value) || value.businessId !== expectedBusinessId ||
    typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1 ||
    !isRecord(value.definition)) {
    throw new Error('业务接口响应缺少匹配的业务 ID、有效修订号或定义');
  }
  const definition = value.definition;
  const validStringMap = (candidate: unknown) => isRecord(candidate) &&
    Object.values(candidate).every((item) => typeof item === 'string');
  const validEntry = (entry: unknown) => {
    if (!isRecord(entry)) return false;
    if (entry.kind === 'device') {
      return (entry.ui == null || typeof entry.ui === 'string') &&
      (entry.interaction == null || typeof entry.interaction === 'string');
    }
    return entry.kind === 'external' && (entry.name == null || typeof entry.name === 'string') &&
      (entry.values == null || validStringMap(entry.values)) &&
      (entry.valueDescriptions == null || validStringMap(entry.valueDescriptions));
  };
  const validStep = (step: unknown) => isRecord(step) &&
    typeof step.action === 'string' && step.action.trim().length > 0 &&
    (step.target == null || step.target === 'local' || step.target === 'target') &&
    (step.with == null || isRecord(step.with)) &&
    (step.produces == null || validStringMap(step.produces)) &&
    (step.ui == null || typeof step.ui === 'string') &&
    (step.bind == null || validStringMap(step.bind));
  const validUi = (ui: unknown) => isRecord(ui) &&
    typeof ui.key === 'string' && ui.key.length > 0 &&
    (ui.owner === 'local' || ui.owner === 'target') &&
    typeof ui.template === 'string' && ui.template.length > 0 &&
    isRecord(ui.fields);
  const validFlow = (flow: unknown) => isRecord(flow) &&
    typeof flow.key === 'string' && flow.key.length > 0 &&
    (flow.entry == null || validEntry(flow.entry)) &&
    Array.isArray(flow.steps) && flow.steps.every(validStep);
  const devices = definition.devices;
  if (definition.id !== expectedBusinessId || typeof definition.name !== 'string' ||
    typeof definition.description !== 'string' ||
    !isRecord(devices) || Object.keys(devices).some((role) => role !== 'local' && role !== 'target') ||
    Object.values(devices).some((slot) => !isRecord(slot) || Object.keys(slot).length > 0) ||
    typeof definition.mirror !== 'boolean' ||
    !Array.isArray(definition.uis) || !definition.uis.every(validUi) ||
    new Set(definition.uis.map((ui) => (ui as UnknownRecord).key)).size !== definition.uis.length ||
    !Array.isArray(definition.flows) || !definition.flows.every(validFlow) ||
    new Set(definition.flows.map((flow) => (flow as UnknownRecord).key)).size !== definition.flows.length) {
    throw new Error('业务定义响应结构无效');
  }
  const normalizedDefinition = definition as unknown as BusinessDefinition;
  normalizedDefinition.flows.forEach((flow) => {
    if (flow.entry?.kind === 'external') {
      flow.entry.values ||= {};
      flow.entry.valueDescriptions ||= {};
    }
    flow.steps.forEach((step) => {
      step.with ||= {};
      step.bind ||= {};
    });
  });
  return { revision: value.revision, definition: normalizedDefinition };
}

export function parseBusinessResources(value: unknown, expectedBusinessId: string): BusinessEditorResources {
  if (!isRecord(value) || value.businessId !== expectedBusinessId ||
    !Array.isArray(value.uis) || !Array.isArray(value.values)) {
    throw new Error('业务资源接口响应结构无效');
  }
  const validUi = value.uis.every((item) => isRecord(item) && typeof item.key === 'string' &&
    (item.owner === null || item.owner === 'local' || item.owner === 'target') &&
    typeof item.template === 'string' && typeof item.initial === 'boolean' &&
    typeof item.origin === 'string' && Array.isArray(item.referencedBy) &&
    item.referencedBy.every((reference) => typeof reference === 'string'));
  const validValue = value.values.every((item) => isRecord(item) && typeof item.name === 'string' &&
    typeof item.type === 'string' && typeof item.flowKey === 'string' &&
    typeof item.origin === 'string' && typeof item.fromTrigger === 'boolean' &&
    typeof item.transient === 'boolean');
  if (!validUi || !validValue) throw new Error('业务资源条目结构无效');
  return value as unknown as BusinessEditorResources;
}
