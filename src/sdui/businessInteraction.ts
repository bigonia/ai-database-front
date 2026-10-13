import type { BusinessDefinition, BusinessUiResource } from '@/api/business';

export function uniqueBusinessName(prefix: string, keys: string[]): string {
  let ordinal = 1;
  while (keys.includes(`${prefix}${ordinal}`)) ordinal++;
  return `${prefix}${ordinal}`;
}

export function renamePageReferences(definition: BusinessDefinition, previous: string, name: string) {
  definition.flows.forEach(flow => {
    if (flow.entry?.kind === 'device' && flow.entry.ui === previous) flow.entry.ui = name;
    flow.steps.forEach(step => { if (step.action === 'ui.show' && step.ui === previous) step.ui = name; });
  });
}

export function renameMenuActionReferences(definition: BusinessDefinition, previous: string, name: string) {
  definition.uis.forEach(ui => {
    if (ui.template !== 'menu_section' || !Array.isArray(ui.fields.items)) return;
    ui.fields.items.forEach(item => { if (item.token === `@${previous}`) item.token = `@${name}`; });
  });
}

export function removeMenuItemBinding(definition: BusinessDefinition, ui: BusinessUiResource, index: number) {
  definition.flows.forEach(flow => {
    if (flow.entry?.kind !== 'device' || flow.entry.ui !== ui.key || !flow.entry.interaction?.startsWith('menu.item.')) return;
    const ordinal = Number(flow.entry.interaction.slice('menu.item.'.length));
    if (ordinal === index + 1) flow.entry.interaction = '';
    else if (ordinal > index + 1) flow.entry.interaction = `menu.item.${ordinal - 1}`;
  });
}
