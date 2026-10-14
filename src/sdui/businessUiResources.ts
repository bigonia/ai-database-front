import type { BusinessDefinition, BusinessUiResource, SectionTemplate } from '@/types/sdui-business';
import { removeMenuItemBinding, renamePageReferences, uniqueBusinessName } from '@/sdui/businessInteraction';

export function createUiResource(definition: BusinessDefinition, template: string, fields: Record<string, unknown>): BusinessUiResource {
  const ui: BusinessUiResource = {
    key: uniqueBusinessName('页面', definition.uis.map(item => item.key)),
    template,
    fields,
    owner: 'local'
  };
  definition.uis.push(ui);
  return ui;
}

export function renameUiResource(definition: BusinessDefinition, ui: BusinessUiResource, rawName: string): 'renamed' | 'unchanged' | 'invalid' {
  const name = rawName.trim();
  if (!name || definition.uis.some(item => item !== ui && item.key === name)) return 'invalid';
  if (name === ui.key) return 'unchanged';
  const previous = ui.key;
  ui.key = name;
  renamePageReferences(definition, previous, name);
  return 'renamed';
}

export function moveUiResource(definition: BusinessDefinition, index: number, direction: -1 | 1): boolean {
  const nextIndex = index + direction;
  if (index < 0 || index >= definition.uis.length || nextIndex < 0 || nextIndex >= definition.uis.length) return false;
  [definition.uis[index], definition.uis[nextIndex]] = [definition.uis[nextIndex], definition.uis[index]];
  return true;
}

export function replaceUiTemplate(
  definition: BusinessDefinition,
  ui: BusinessUiResource,
  template: string,
  fields: Record<string, unknown>
): void {
  definition.flows.forEach(flow => {
    if (flow.entry?.kind === 'device' && flow.entry.ui === ui.key) flow.entry.interaction = '';
  });
  ui.template = template;
  ui.fields = fields;
}

export function addUiArrayItem(ui: BusinessUiResource, fieldName: string, item: unknown): void {
  const values = ui.fields[fieldName];
  if (Array.isArray(values)) values.push(item);
  else ui.fields[fieldName] = [item];
}

export function removeUiArrayItem(
  definition: BusinessDefinition,
  ui: BusinessUiResource,
  fieldName: string,
  index: number
): boolean {
  const values = ui.fields[fieldName];
  if (!Array.isArray(values) || index < 0 || index >= values.length) return false;
  values.splice(index, 1);
  if (ui.template === 'menu_section' && fieldName === 'items') removeMenuItemBinding(definition, ui, index);
  return true;
}

export function removeUiResource(definition: BusinessDefinition, key: string): number {
  const index = definition.uis.findIndex(ui => ui.key === key);
  if (index >= 0) definition.uis.splice(index, 1);
  return index;
}

export function uiRemovalReferences(definition: BusinessDefinition, key: string): string[] {
  return definition.flows.flatMap(flow => {
    const found: string[] = [];
    if (flow.entry?.kind === 'device' && flow.entry.ui === key) found.push(`${flow.key} 的设备触发器`);
    flow.steps.forEach((step, index) => { if (step.ui === key) found.push(`${flow.key} 第 ${index + 1} 步`); });
    return found;
  });
}

export function uiArrayBounds(template: SectionTemplate | undefined, fieldName: string) {
  const constraints = template?.constraints || {};
  return {
    min: constraints[`${fieldName}_min`] ?? 0,
    max: constraints[`${fieldName}_max`] ?? Number.POSITIVE_INFINITY
  };
}

export function uiArrayBoundsLabel(template: SectionTemplate | undefined, fieldName: string): string {
  const constraints = template?.constraints || {};
  const min = constraints[`${fieldName}_min`];
  const max = constraints[`${fieldName}_max`];
  if (min != null && max != null) return `${min}～${max} 项`;
  if (min != null) return `至少 ${min} 项`;
  if (max != null) return `最多 ${max} 项`;
  return '目录未声明项数限制';
}
