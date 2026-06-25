<template>
  <div class="ui-panel">
    <div class="panel-header">
      <div>
        <strong>UI 状态</strong>
        <small>部署时初始化模板上下文</small>
      </div>
      <el-button size="small" type="primary" text :disabled="!slots.length" @click="addBinding">
        + 绑定
      </el-button>
    </div>

    <div v-if="bindings.length" class="binding-list">
      <div v-for="(binding, index) in bindings" :key="`${index}-${binding.slotId}`" class="binding-card">
        <el-select
          :model-value="String(binding.slotId || '')"
          size="small"
          placeholder="槽位"
          @change="updateBinding(index, 'slotId', $event)"
        >
          <el-option
            v-for="slot in slots"
            :key="slot.slotId"
            :label="slot.displayName || slot.slotId"
            :value="slot.slotId"
          />
        </el-select>
        <el-select
          :model-value="String(binding.templateKey || '')"
          size="small"
          filterable
          placeholder="UI 模板"
          @change="updateBinding(index, 'templateKey', $event)"
        >
          <el-option
            v-for="template in templates"
            :key="template.templateKey"
            :label="template.name || template.templateKey"
            :value="template.templateKey"
          />
        </el-select>
        <el-button text type="danger" size="small" @click="removeBinding(index)">删除</el-button>
        <div v-if="bindingVariables(binding).length" class="variable-overrides">
          <label v-for="variable in bindingVariables(binding)" :key="variable.variableKey">
            <span>{{ variable.variableKey }}</span>
            <el-input
              :model-value="String(bindingValue(binding, variable.variableKey))"
              size="small"
              placeholder="部署初始化值（可选）"
              @update:model-value="updateVariable(index, variable.variableKey, $event)"
            />
          </label>
        </div>
      </div>
    </div>
    <el-empty v-else description="未绑定 UI 模板" :image-size="34" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  slots: NodeWorkflowSlot[];
  bindings: Array<Record<string, unknown>>;
  templates: Array<{
    templateKey: string;
    name: string;
    variables?: Array<{ variableKey: string; sectionId: string; field: string }>;
  }>;
}>();

const emit = defineEmits<{
  'update:bindings': [bindings: Array<Record<string, unknown>>];
}>();

function addBinding() {
  const usedSlots = new Set(props.bindings.map((item) => String(item.slotId || '')));
  const slot = props.slots.find((item) => !usedSlots.has(item.slotId)) || props.slots[0];
  emit('update:bindings', [
    ...props.bindings,
    { slotId: slot?.slotId || '', templateKey: '', variables: {}}
  ]);
}

function updateBinding(index: number, field: string, value: unknown) {
  const next = props.bindings.map((item, itemIndex) =>
    itemIndex === index ? { ...item, [field]: value } : item
  );
  emit('update:bindings', next);
}

function removeBinding(index: number) {
  emit('update:bindings', props.bindings.filter((_, itemIndex) => itemIndex !== index));
}

function bindingVariables(binding: Record<string, unknown>) {
  return props.templates.find((item) => item.templateKey === String(binding.templateKey || ''))?.variables || [];
}

function bindingValue(binding: Record<string, unknown>, variableKey: string) {
  const variables = binding.variables;
  return typeof variables === 'object' && variables !== null
    ? (variables as Record<string, unknown>)[variableKey] ?? ''
    : '';
}

function updateVariable(index: number, variableKey: string, value: unknown) {
  const binding = props.bindings[index];
  if (!binding) return;
  const variables = typeof binding.variables === 'object' && binding.variables !== null
    ? binding.variables as Record<string, unknown>
    : {};
  const next = props.bindings.map((item, itemIndex) =>
    itemIndex === index
      ? { ...item, variables: { ...variables, [variableKey]: value }}
      : item
  );
  emit('update:bindings', next);
}
</script>

<style scoped>
.ui-panel {
  padding: 12px 0;
  border-top: 1px solid rgba(18, 32, 51, 0.08);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 8px;
}

.panel-header strong,
.panel-header small {
  display: block;
}

.panel-header small {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}

.binding-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px;
}

.binding-card {
  display: grid;
  grid-template-columns: 1fr 1.25fr auto;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 10px;
  background: #f8fafc;
}

.variable-overrides {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(18, 32, 51, 0.08);
}

.variable-overrides label {
  display: grid;
  grid-template-columns: minmax(80px, 0.8fr) 1.4fr;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 11px;
}
</style>
