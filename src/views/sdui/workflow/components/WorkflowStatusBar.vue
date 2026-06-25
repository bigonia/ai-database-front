<template>
  <section class="status-bar">
    <div class="status-main">
      <label class="name-field">
        <span>工作流名称</span>
        <el-input
          :model-value="name"
          size="small"
          @update:model-value="$emit('update:name', String($event || ''))"
        />
      </label>
      <div class="status-metrics">
        <div><strong>{{ slots.length }}</strong><span>槽位</span></div>
        <div><strong>{{ nodes.length }}</strong><span>节点</span></div>
        <div><strong>{{ edges.length }}</strong><span>连线</span></div>
        <div><strong>{{ uiTemplates.length }}</strong><span>UI 模板</span></div>
      </div>
    </div>
    <div class="lifecycle">
      <span v-for="(step, index) in steps" :key="step.label" :class="{ active: step.active }">
        <i>{{ index + 1 }}</i>{{ step.label }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  slots: NodeWorkflowSlot[];
  nodes: NodeWorkflowNode[];
  edges: NodeWorkflowEdge[];
  uiTemplates: Array<Record<string, unknown>>;
  saved: boolean;
}>();

defineEmits<{
  'update:name': [name: string];
}>();

const steps = computed(() => [
  { label: '定义槽位', active: props.slots.length > 0 },
  { label: '编排节点', active: props.nodes.length > 0 },
  { label: '建立连线', active: props.edges.length > 0 },
  { label: '保存定义', active: props.saved }
]);
</script>

<style scoped>
.status-bar {
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
  background: #fff;
}

.status-main,
.status-metrics,
.lifecycle {
  display: flex;
  align-items: center;
}

.status-main {
  justify-content: space-between;
  gap: 24px;
}

.name-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(460px, 50%);
  color: #64748b;
  font-size: 12px;
}

.name-field :deep(.el-input) {
  flex: 1;
}

.status-metrics {
  gap: 24px;
}

.status-metrics div {
  text-align: center;
}

.status-metrics strong,
.status-metrics span {
  display: block;
}

.status-metrics strong {
  color: #122033;
  font-size: 18px;
}

.status-metrics span {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 11px;
}

.lifecycle {
  gap: 8px;
  margin-top: 12px;
}

.lifecycle span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.lifecycle span:not(:last-child)::after {
  width: 28px;
  height: 1px;
  margin-left: 2px;
  background: #dbe3ec;
  content: '';
}

.lifecycle i {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  background: #edf1f5;
  font-style: normal;
  font-size: 11px;
}

.lifecycle .active {
  color: #1677ff;
}

.lifecycle .active i {
  background: #1677ff;
  color: #fff;
}
</style>
