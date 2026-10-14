import type { Ref } from 'vue';
import { uniqueBusinessName } from '@/sdui/businessInteraction';
import type { BusinessDefinition, BusinessFlow, BusinessUiResource } from '@/types/sdui-business';

export function useBusinessDeviceInteractions(options: {
  definition: Ref<BusinessDefinition | null>;
  selectedFlowKey: Ref<string>;
  selectedStepIndex: Ref<number>;
  showResources: Ref<boolean>;
  markDirty: () => void;
  addFlow: () => void;
}) {
  const triggerUi = (flow: BusinessFlow) => {
    const entry = flow.entry;
    return entry?.kind === 'device' ? options.definition.value?.uis.find(ui => ui.key === entry.ui) : undefined;
  };

  function menuActionFlows(ui: BusinessUiResource, index: number) {
    const interaction = `menu.item.${index + 1}`;
    return options.definition.value?.flows.filter((flow, flowIndex) => flowIndex > 0 && (!flow.entry ||
      flow.entry.kind === 'device' && flow.entry.ui === ui.key && flow.entry.interaction === interaction)) || [];
  }

  function clearMenuAction(flow: BusinessFlow) {
    if (flow.entry?.kind !== 'device' || !flow.entry.interaction?.startsWith('menu.item.')) return;
    const items = triggerUi(flow)?.fields.items;
    if (Array.isArray(items)) items.forEach(item => { if (item.token === `@${flow.key}`) item.token = ''; });
  }

  function deviceInteractionOptions(flow: BusinessFlow) {
    const ui = triggerUi(flow);
    const definition = options.definition.value;
    const result = ['pwr', 'plus'].flatMap(button =>
      ['short_press', 'long_press', 'down', 'up'].map(event => {
        const value = `button.${button}.${event}`;
        const occupied = definition?.flows.some(item => item !== flow && item.entry?.kind === 'device' && item.entry.interaction === value);
        const native = ui?.template === 'menu_section' && event === 'short_press';
        return { value, label: `${button === 'pwr' ? '电源按钮' : '加号按钮'} · ${{ short_press: '短按', long_press: '长按', down: '按下', up: '松开' }[event]}${native ? '（菜单导航占用）' : occupied ? '（已配置）' : ''}`, disabled: native || Boolean(occupied) };
      }));
    if (ui?.template === 'menu_section' && Array.isArray(ui.fields.items)) {
      ui.fields.items.forEach((item, index) => result.push({ value: `menu.item.${index + 1}`,
        label: `确认菜单项：${item.label || `选项 ${index + 1}`}`, disabled: Boolean(item.token && item.token !== `@${flow.key}`) }));
    }
    return result;
  }

  function deviceInteractionLabel(flow: BusinessFlow) {
    return deviceInteractionOptions(flow).find(option => option.value === (flow.entry?.kind === 'device' ? flow.entry.interaction : ''))?.label || '设备内部触发 · 待设置';
  }

  function setDeviceInteraction(flow: BusinessFlow, interaction: string) {
    if (flow.entry?.kind !== 'device' || deviceInteractionOptions(flow).find(option => option.value === interaction)?.disabled) return;
    clearMenuAction(flow);
    flow.entry.interaction = interaction;
    const ui = triggerUi(flow);
    if (interaction.startsWith('menu.item.') && Array.isArray(ui?.fields.items)) {
      const item = ui.fields.items[Number(interaction.slice('menu.item.'.length)) - 1];
      if (item) item.token = `@${flow.key}`;
    }
    options.markDirty();
  }

  function bindMenuAction(ui: BusinessUiResource, index: number, value: string) {
    const definition = options.definition.value;
    if (!definition || !Array.isArray(ui.fields.items)) return;
    const item = ui.fields.items[index];
    if (!item) return;
    let flow = definition.flows.find(candidate => `@${candidate.key}` === value);
    if (value === '__create__') {
      if (!definition.flows.length) options.addFlow();
      flow = { key: uniqueBusinessName('菜单动作', definition.flows.map(candidate => candidate.key)), steps: [] };
      definition.flows.push(flow);
    }
    if (!flow || !menuActionFlows(ui, index).includes(flow)) return;
    const previous = definition.flows.find(candidate => `@${candidate.key}` === item.token);
    if (previous?.entry?.kind === 'device' && previous !== flow) previous.entry.interaction = '';
    flow.entry = { kind: 'device', ui: ui.key, interaction: `menu.item.${index + 1}` };
    item.token = `@${flow.key}`;
    options.selectedFlowKey.value = flow.key;
    options.selectedStepIndex.value = flow.steps.length ? 0 : -1;
    options.showResources.value = false;
    options.markDirty();
  }

  function addPageJump(flow: BusinessFlow, key: string) {
    const ui = options.definition.value?.uis.find(item => item.key === key);
    if (!ui) return;
    flow.steps.push({ action: 'ui.show', target: ui.owner, ui: key, with: {}, produces: {}, bind: {}});
    options.selectedStepIndex.value = flow.steps.length - 1;
    options.markDirty();
  }

  return { triggerUi, menuActionFlows, clearMenuAction, deviceInteractionOptions,
    deviceInteractionLabel, setDeviceInteraction, bindMenuAction, addPageJump };
}
