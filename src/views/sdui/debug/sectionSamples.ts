import type { DebugSectionDisplayField, DebugSectionType } from './types';

const SAMPLE_VALUES: Record<string, Record<string, unknown>> = {
  hero_section: { value: '86%', label: '核心指标', subtitle: '补充说明文字', tone: 'primary', iconSrc: 'start', iconSymbol: 'start', progress: 86 },
  metric_section: { metrics: [{ label: '指标 A', value: '24' }, { label: '指标 B', value: '68%' }] },
  chart_section: { title: '趋势图表', points: [18, 42, 32, 68, 54, 82], progress: 72 },
  progress_section: { title: '进度卡片', progress: 68, progressText: '68%' },
  text_section: { title: '文本卡片', body: '这里展示一段通用的正文或说明内容。' },
  timer_section: {
    title: '计时卡片',
    progress: 64,
    timer: { elapsedMs: 754000, running: true }
  },
  image_section: { iconSrc: 'file', title: '图标卡片', subtitle: '辅助说明文字' },
  overlay_section: { title: '浮层提示', body: '这里展示需要强调的提示内容。', tone: 'warning', unreadCount: 2, autoHideMs: 3000 },
  action_section: { actions: [{ id: 'primary', label: '主要操作', tone: 'primary', enabled: true }, { id: 'secondary', label: '次要操作', tone: 'secondary', enabled: true }] },
  toggle_section: { options: [{ id: 'option_a', label: '选项 A', active: true }, { id: 'option_b', label: '选项 B', active: false }] },
  list_section: { items: [{ id: 'item_1', title: '列表项 A', subtitle: '辅助描述', tone: 'primary', iconSrc: 'file' }, { id: 'item_2', title: '列表项 B', subtitle: '辅助描述', tone: 'neutral', iconSrc: 'start' }] },
  nav_section: { tabs: [{ id: 'tab_a', label: '标签 A' }, { id: 'tab_b', label: '标签 B' }], activeTab: 0 }
};

export function buildSectionFields(typeMeta: DebugSectionType, useSamples = true) {
  const samples = SAMPLE_VALUES[typeMeta.type] || {};
  return typeMeta.displayFields.reduce<Record<string, unknown>>((fields, field) => {
    fields[field.name] = useSamples && field.name in samples ? cloneValue(samples[field.name]) : defaultValueForField(field);
    return fields;
  }, {});
}

export function defaultValueForField(field: DebugSectionDisplayField): unknown {
  if (field.default !== undefined && field.default !== null && field.default !== '') return cloneValue(field.default);
  if (field.type === 'array') return [];
  if (field.type === 'object') {
    return field.children.reduce<Record<string, unknown>>((value, child) => {
      value[child.name] = defaultValueForField(child);
      return value;
    }, {});
  }
  if (field.type === 'bool') return false;
  if (field.type === 'int' || field.type === 'float') return field.min ?? 0;
  if (field.type === 'enum') return field.options[0] || '';
  if (field.type === 'color') return '#2563eb';
  return '';
}

export function getSectionSampleFields(typeMeta: DebugSectionType) {
  return buildSectionFields(typeMeta, true);
}

function cloneValue<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
