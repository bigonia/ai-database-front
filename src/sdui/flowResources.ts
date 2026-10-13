import type { BusinessDefinition, BusinessFlow, ActionCatalogEntry } from '@/api/business';

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

/** Resources retain the latest result across flows and devices in a business deployment. */
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

export function availableFlowResources(resources: FlowResource[], _flowKey: string, _stepIndex: number, type?: string) {
  return resources.filter(resource => !type || resource.type.toLowerCase() === type.toLowerCase());
}

export function registerStepResources(flow: BusinessFlow, stepIndex: number, outputs: Record<string, string>) {
  const step = flow.steps[stepIndex];
  const references = new Set(flow.steps.flatMap(item => Object.values(item.produces || {})));
  if (flow.entry?.kind === 'external') Object.keys(flow.entry.values || {}).forEach(name => references.add(`@${flow.key}.${name}`));
  step.produces ||= {};
  for (const slot of Object.keys(outputs)) {
    if (step.produces[slot]) continue;
    const base = slot === 'audio' ? '采集音频' : slot === 'text' ? '识别文本' : slot;
    let name = base;
    let suffix = 2;
    while (references.has(`@${flow.key}.${name}`)) name = `${base}${suffix++}`;
    step.produces[slot] = `@${flow.key}.${name}`;
    references.add(step.produces[slot]);
  }
}
