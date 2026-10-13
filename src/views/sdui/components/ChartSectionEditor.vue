<template>
  <div class="chart-editor">
    <label>标题（可选）<el-input :model-value="fields.title || ''" @update:model-value="setField('title', $event)"/></label>
    <template v-if="type === 'chart_section'">
      <label>图表类型<el-select :model-value="fields.chart_type || 'line'" @update:model-value="setField('chart_type', $event)"><el-option label="折线" value="line"/><el-option label="柱状" value="bar"/><el-option label="面积" value="area"/></el-select></label>
      <el-radio-group :model-value="multiple" @update:model-value="switchSeries(Boolean($event))"><el-radio-button :value="false">单组</el-radio-button><el-radio-button :value="true">多组</el-radio-button></el-radio-group>
      <div v-for="(group, groupIndex) in groups" :key="groupIndex" class="chart-group">
        <div>数据组 {{ groupIndex + 1 }}<el-button v-if="multiple" link type="danger" :disabled="groups.length <= 1" @click="removeGroup(groupIndex)">删除组</el-button></div>
        <div class="points"><el-input-number v-for="(_, index) in group.points" :key="index" :model-value="group.points[index]" :min="-32768" :max="32767" :precision="0" controls-position="right" @update:model-value="setPoint(groupIndex, index, $event)"/></div>
      </div>
      <div><el-button :disabled="groups[0]?.points.length >= pointLimit" @click="resizePoints(1)">添加数据点</el-button><el-button :disabled="groups[0]?.points.length <= 2" @click="resizePoints(-1)">删除末点</el-button><el-button v-if="multiple" :disabled="groups.length >= 3" @click="addGroup">添加数据组</el-button></div>
      
    </template>
    <template v-else-if="type === 'distribution_section'">
      <label>图表类型<el-select :model-value="fields.chart_type || 'donut'" @update:model-value="setField('chart_type', $event)"><el-option label="环形" value="donut"/><el-option label="饼图" value="pie"/></el-select></label>
      <div v-for="(value, index) in fields.values || []" :key="index"><el-input-number :model-value="value" :min="0" @update:model-value="setValue(index, $event)"/><el-button link type="danger" :disabled="fields.values.length <= 1" @click="setField('values', fields.values.filter((_: number, i: number) => i !== index))">删除</el-button></div>
      <el-button :disabled="fields.values?.length >= 4" @click="setField('values', [...(fields.values || []), 0])">添加数值</el-button>
    </template>
    <template v-else>
      <label v-for="item in gaugeFields" :key="item.key">{{ item.label }}<el-input-number :model-value="fields[item.key] ?? item.defaultValue" @update:model-value="setField(item.key, $event)"/></label>
    </template>
    
    <el-alert v-if="validationError" type="warning" :closable="false" :title="validationError"/>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { chartSectionError } from './chartSections';
const props = defineProps<{ type: string; fields: Record<string, any> }>();
const emit = defineEmits<{ change: [fields: Record<string, any>] }>();
const multiple = computed(() => 'series' in props.fields);
const groups = computed<{points: number[]}[]>(() => multiple.value ? props.fields.series || [] : [{ points: props.fields.points || [] }]);
const pointLimit = computed(() => props.fields.chart_type === 'bar' ? 12 : 32);
const validationError = computed(() => chartSectionError(props.type, props.fields));
const gaugeFields = [{key:'value',label:'当前值',defaultValue:0},{key:'min',label:'最小值',defaultValue:0},{key:'max',label:'最大值',defaultValue:100}];
function setField(key: string, value: unknown) { emit('change', { ...props.fields, [key]: value }); }
function updateGroups(next: {points: number[]}[]) { const fields = {...props.fields}; delete fields.points; delete fields.series; if (multiple.value) fields.series = next; else fields.points = next[0].points; emit('change', fields); }
function switchSeries(value: boolean) { const fields = {...props.fields}; delete fields.points; delete fields.series; if (value) fields.series = [{points: [...(groups.value[0]?.points || [0, 0])]}]; else fields.points = [...(groups.value[0]?.points || [0, 0])]; emit('change', fields); }
function setPoint(group: number, index: number, value: number | undefined) { const next = groups.value.map(item => ({points: [...item.points]})); next[group].points[index] = value as number; updateGroups(next); }
function resizePoints(delta: number) { updateGroups(groups.value.map(item => ({ points: delta > 0 ? [...item.points, 0] : item.points.slice(0, -1) }))); }
function addGroup() { updateGroups([...groups.value, {points: Array(groups.value[0]?.points.length || 2).fill(0)}]); }
function removeGroup(index: number) { updateGroups(groups.value.filter((_, i) => i !== index)); }
function setValue(index: number, value: number | undefined) { const next = [...props.fields.values]; next[index] = value; setField('values', next); }
</script>
<style scoped>
.chart-editor,.chart-editor label,.chart-group{display:grid;gap:10px;min-width:0}.chart-editor{margin:12px 0}.chart-editor small{color:#667085;font-size:12px}.points{display:flex;flex-wrap:wrap;gap:8px}.points :deep(.el-input-number){width:130px}.chart-group{padding:10px;background:#f8fafc;border-radius:6px}
</style>
