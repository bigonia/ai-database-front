<template>
  <svg v-if="!error" viewBox="0 0 128 96" role="img" aria-label="图表示意预览" class="chart-preview">
    <template v-if="type === 'chart_section'">
      <template v-for="(points, groupIndex) in series" :key="groupIndex">
        <template v-if="fields.chart_type === 'bar'"><rect v-for="(value, index) in points" :key="index" :x="8 + index * step + groupIndex * barWidth" :y="Math.min(y(value), y(0))" :width="Math.max(1, barWidth - 1)" :height="Math.max(1, Math.abs(y(value) - y(0)))" :fill="colors[groupIndex]"/></template>
        <template v-else><path v-if="fields.chart_type === 'area'" :d="`${line(points)} L 120 ${y(0)} L 8 ${y(0)} Z`" :fill="colors[groupIndex]" fill-opacity="0.25"/><path :d="line(points)" fill="none" :stroke="colors[groupIndex]" stroke-width="2"/></template>
      </template>
    </template>
    <template v-else-if="type === 'distribution_section'">
      <circle cx="64" cy="48" r="35" fill="#334155"/>
      <path v-for="(slice, index) in slices" :key="index" :d="slice" :fill="colors[index]"/>
      <circle v-if="fields.chart_type !== 'pie'" cx="64" cy="48" r="21" fill="#f8fafc"/>
    </template>
    <template v-else>
      <path v-for="segment in gaugeSegments" :key="segment.color" :d="gaugeArc(segment.start, segment.end)" fill="none" :stroke="segment.color" stroke-width="9"/>
      <line x1="64" y1="64" :x2="gaugeNeedle.x" :y2="gaugeNeedle.y" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="64" cy="64" r="4" fill="#fff"/>
      <text x="64" y="89" text-anchor="middle" fill="#fff" font-size="21" font-weight="400">{{ fields.value }}</text>
    </template>
  </svg>
  <small v-else>{{ error }}</small>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { chartSectionError, type ChartFields } from './chartSections';
const props = defineProps<{type: string; fields: ChartFields}>();
const colors = ['#38bdf8', '#fb923c', '#4ade80', '#c084fc'];
const error = computed(() => chartSectionError(props.type, props.fields));
const series = computed<number[][]>(() => props.fields.series?.map((group: {points: number[]}) => group.points) || [props.fields.points || []]);
const range = computed(() => { const values = series.value.flat(); return { min: Math.min(0, ...values), max: Math.max(1, ...values) }; });
const step = computed(() => 112 / Math.max(1, series.value[0]?.length || 1));
const barWidth = computed(() => step.value / series.value.length);
function y(value: number) { return 88 - (value - range.value.min) / (range.value.max - range.value.min) * 80; }
function line(points: number[]) { return points.map((value, index) => `${index ? 'L' : 'M'} ${8 + index * 112 / (points.length - 1)} ${y(value)}`).join(' '); }
const slices = computed(() => {
  const values: number[] = props.fields.values || []; const total = values.reduce((a, b) => a + b, 0); if (!total) return [];
  let angle = -Math.PI / 2;
  return values.map(value => {
    const start = angle; angle += value / total * Math.PI * 2;
    if (value === total) return 'M 64 13 A 35 35 0 1 1 64 83 A 35 35 0 1 1 64 13 Z';
    return `M 64 48 L ${64 + 35 * Math.cos(start)} ${48 + 35 * Math.sin(start)} A 35 35 0 ${angle - start > Math.PI ? 1 : 0} 1 ${64 + 35 * Math.cos(angle)} ${48 + 35 * Math.sin(angle)} Z`;
  });
});
const gaugeSegments = [
  { start: 0, end: 0.6, color: '#459efa' },
  { start: 0.6, end: 0.8, color: '#ffb343' },
  { start: 0.8, end: 1, color: '#ec6481' }
];
function gaugeArc(start: number, end: number) {
  const startAngle = Math.PI * (1 + start) + (start > 0 ? 0.008 : 0);
  const endAngle = Math.PI * (1 + end) - (end < 1 ? 0.008 : 0);
  return `M ${64 + 44 * Math.cos(startAngle)} ${64 + 44 * Math.sin(startAngle)} A 44 44 0 0 1 ${64 + 44 * Math.cos(endAngle)} ${64 + 44 * Math.sin(endAngle)}`;
}
const gaugeNeedle = computed(() => {
  const min = props.fields.min ?? 0;
  const max = props.fields.max ?? 100;
  const value = Number(props.fields.value ?? 0);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = Math.PI * (1 + ratio);
  return { x: 64 + 32 * Math.cos(angle), y: 64 + 32 * Math.sin(angle) };
});
</script>
<style scoped>.chart-preview{display:block;width:100%;max-width:256px;margin:auto}</style>
