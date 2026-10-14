import type { BusinessDefinition, BusinessFlow, ActionCatalogEntry } from '@/types/sdui-business';

export interface FlowResource {
  name: string;
  reference: string;
  type: string;
  flowKey: string;
  stepIndex: number;
  slot: string;
  fromTrigger: boolean;
  origin: string;
}

/** Resources belong to one invocation; consumers can only read preceding producers. */
export function collectFlowResources(definition: BusinessDefinition | null, actions: ActionCatalogEntry[]): FlowResource[] {
  return (definition?.flows || []).flatMap(flow => {
    const resources: FlowResource[] = [];
    if (flow.entry?.kind === 'external') {
      for (const [name, type] of Object.entries(flow.entry.values || {})) {
        resources.push({ name, type, reference: `@${flow.key}.${name}`, flowKey: flow.key,
          stepIndex: -1, slot: name, fromTrigger: true, origin: '环节输入' });
      }
    }
    flow.steps.forEach((step, stepIndex) => {
      const outputs = actions.find(action => action.action === step.action)?.out || {};
      for (const [slot, reference] of Object.entries(step.produces || {})) {
        if (!reference) continue;
        const wire = reference.startsWith('@') ? reference : `@${reference}`;
        const prefix = `@${flow.key}.`;
        resources.push({ name: wire.startsWith(prefix) ? wire.slice(prefix.length) : wire.slice(1),
          reference: wire, type: outputs[slot] || '未知', flowKey: flow.key, stepIndex, slot,
          fromTrigger: false, origin: `第 ${stepIndex + 1} 步 · ${step.action}` });
      }
    });
    return resources;
  });
}

export function availableFlowResources(resources: FlowResource[], flowKey: string, stepIndex: number) {
  return resources.filter(resource => resource.flowKey === flowKey && resource.stepIndex < stepIndex);
}

export function registerStepResources(flow: BusinessFlow, stepIndex: number, outputs: Record<string, string>) {
  const step = flow.steps[stepIndex];
  const references = new Set(flow.steps.flatMap(item => Object.values(item.produces || {})));
  if (flow.entry?.kind === 'external') Object.keys(flow.entry.values || {}).forEach(name => references.add(`@${flow.key}.${name}`));
  step.produces ||= {};
  for (const slot of Object.keys(outputs)) {
    if (step.produces[slot]) continue;
    const base = slot === 'result' ? '采集结果' : slot === 'audio' ? '音频' : slot === 'text' ? '文本' : slot;
    let name = base;
    let suffix = 2;
    while (references.has(`@${flow.key}.${name}`)) name = `${base}${suffix++}`;
    step.produces[slot] = `@${flow.key}.${name}`;
    references.add(step.produces[slot]);
  }
}

/** 将可编辑草稿整理为一次采集一个产物；所有消费者引用同一个产物。 */
export function normalizeRecordingProducts(definition: BusinessDefinition) {
  const aliases = new Map<string, string>();
  for (const flow of definition.flows) {
    for (const step of flow.steps) {
      if (step.action !== 'audio.record') continue;
      const outputs = step.produces || {};
      const reference = outputs.result || outputs.audio || outputs.text;
      if (reference) {
        for (const value of Object.values(outputs)) aliases.set(value, reference);
        step.produces = { result: reference };
      }
    }
  }
  for (const flow of definition.flows) {
    for (const step of flow.steps) {
      for (const arguments_ of [step.with, step.bind]) {
        for (const [key, value] of Object.entries(arguments_ || {})) {
          if (value === '@') delete arguments_[key];
          else if (typeof value === 'string' && aliases.has(value)) arguments_[key] = aliases.get(value) || value;
        }
      }
      if (step.action === 'audio.play' && !Object.prototype.hasOwnProperty.call(step.with || {}, 'source')) {
        const input = ['audio', 'text'].find(key => Object.prototype.hasOwnProperty.call(step.with || {}, key));
        if (input) {
          step.with.source = step.with[input];
          delete step.with.audio;
          delete step.with.text;
        }
      }
    }
  }
}
