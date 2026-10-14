export const isChartSection = (type: string) => ['chart_section', 'distribution_section', 'gauge_section'].includes(type);

export interface ChartFields extends Record<string, unknown> {
  title?: string;
  chart_type?: string;
  points?: number[];
  series?: Array<{ points: number[] }>;
  values?: number[];
  value?: number | string;
  min?: number;
  max?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function defaultChartFields(type: string): ChartFields {
  if (type === 'chart_section') return { title: '', chart_type: 'line', points: [0, 10] };
  if (type === 'distribution_section') return { title: '', chart_type: 'donut', values: [30, 70] };
  return { title: '健康评分', value: 68, min: 0, max: 100 };
}

export function chartSectionError(type: string, fields: ChartFields): string {
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (typeof fields.title === 'string' && new TextEncoder().encode(fields.title).length > 64) return '标题最多 64 UTF-8 字节';
  if (type === 'chart_section') {
    if (!['line', 'bar', 'area'].includes(fields.chart_type ?? 'line')) return '请选择折线、柱状或面积图';
    if (('points' in fields) === ('series' in fields)) return 'points 与 series 必须且只能填写一个';
    const rawSeries: unknown = 'series' in fields ? fields.series : [{ points: fields.points }];
    if (!Array.isArray(rawSeries) || rawSeries.length < 1 || rawSeries.length > 3) return '需要 1～3 组数据';
    const max = fields.chart_type === 'bar' ? 12 : 32;
    let firstPointCount: number | undefined;
    for (const group of rawSeries) {
      if (!isRecord(group) || Object.keys(group).some(key => key !== 'points') || !Array.isArray(group.points)) return '每组仅支持 points 数组';
      if (group.points.length < 2 || group.points.length > max) return `每组需要 2～${max} 个数据点`;
      if (firstPointCount === undefined) firstPointCount = group.points.length;
      if (group.points.length !== firstPointCount) return '各组点数必须一致';
      if (group.points.some((point: unknown) => !Number.isInteger(point) || Number(point) < -32768 || Number(point) > 32767)) return '数据点必须是 -32768～32767 的整数';
    }
  } else if (type === 'distribution_section') {
    if (!['donut', 'pie'].includes(fields.chart_type ?? 'donut')) return '请选择环形或饼图';
    if (!Array.isArray(fields.values) || fields.values.length < 1 || fields.values.length > 4) return '需要 1～4 项数值';
    if (fields.values.some((value: unknown) => !finite(value) || Number(value) < 0)) return '分布数值须为非负有限数值';
  } else {
    if (![fields.value, fields.min ?? 0, fields.max ?? 100].every(finite)) return '仪表值及上下限必须为有限数值';
    if ((fields.min ?? 0) >= (fields.max ?? 100)) return '最大值必须大于最小值';
  }
  return '';
}
