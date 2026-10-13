export const isChartSection = (type: string) => ['chart_section', 'distribution_section', 'gauge_section'].includes(type);

export function defaultChartFields(type: string): Record<string, any> {
  if (type === 'chart_section') return { title: '', chart_type: 'line', points: [0, 10] };
  if (type === 'distribution_section') return { title: '', chart_type: 'donut', values: [30, 70] };
  return { title: '健康评分', value: 68, min: 0, max: 100 };
}

export function chartSectionError(type: string, fields: Record<string, any>): string {
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (new TextEncoder().encode(fields.title || '').length > 64) return '标题最多 64 UTF-8 字节';
  if (type === 'chart_section') {
    if (!['line', 'bar', 'area'].includes(fields.chart_type ?? 'line')) return '请选择折线、柱状或面积图';
    if (('points' in fields) === ('series' in fields)) return 'points 与 series 必须且只能填写一个';
    const series = 'series' in fields ? fields.series : [{ points: fields.points }];
    if (!Array.isArray(series) || series.length < 1 || series.length > 3) return '需要 1～3 组数据';
    const max = fields.chart_type === 'bar' ? 12 : 32;
    for (const group of series) {
      if (!group || Object.keys(group).some(key => key !== 'points') || !Array.isArray(group.points)) return '每组仅支持 points 数组';
      if (group.points.length < 2 || group.points.length > max) return `每组需要 2～${max} 个数据点`;
      if (group.points.length !== series[0].points.length) return '各组点数必须一致';
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
