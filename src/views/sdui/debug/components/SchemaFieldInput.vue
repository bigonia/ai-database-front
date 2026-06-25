<template>
  <div class="schema-input" :class="{ nested }">
    <template v-if="field.type === 'array'">
      <div class="array-list">
        <div v-for="(item, index) in arrayValue" :key="index" class="array-item">
          <div class="array-item-head">
            <span>{{ field.label || field.name }} {{ index + 1 }}</span>
            <el-button type="danger" text size="small" @click="removeArrayItem(index)">删除</el-button>
          </div>

          <div v-if="field.children.length" class="child-grid">
            <label v-for="child in field.children" :key="child.name" class="child-field">
              <span>{{ child.label || child.name }}<i v-if="child.required">*</i></span>
              <SchemaFieldInput
                :field="child"
                :model-value="asRecord(item)[child.name]"
                :placeholder="child.name"
                nested
                @update:model-value="setArrayChild(index, child.name, $event)"
              />
            </label>
          </div>

          <SchemaFieldInput
            v-else
            :field="arrayItemField"
            :model-value="item"
            :placeholder="`${field.label || field.name} ${index + 1}`"
            nested
            @update:model-value="setArrayItem(index, $event)"
          />
        </div>

        <el-button class="add-item-button" plain @click="addArrayItem">
          <span class="plus">＋</span> 添加{{ field.label || '项目' }}
        </el-button>
      </div>
    </template>

    <div v-else-if="field.type === 'object'" class="object-fields">
      <label v-for="child in field.children" :key="child.name" class="child-field">
        <span>{{ child.label || child.name }}<i v-if="child.required">*</i></span>
        <SchemaFieldInput
          :field="child"
          :model-value="objectValue[child.name]"
          :placeholder="child.name"
          nested
          @update:model-value="setObjectChild(child.name, $event)"
        />
      </label>
      <div v-if="!field.children.length" class="schema-empty">当前对象没有可编辑字段</div>
    </div>

    <el-select
      v-else-if="field.type === 'enum'"
      :model-value="String(modelValue ?? '')"
      class="full-control"
      :placeholder="placeholder || `请选择${field.label || field.name}`"
      @change="updateValue"
    >
      <el-option v-for="option in field.options" :key="option" :label="option" :value="option" />
    </el-select>

    <el-switch
      v-else-if="field.type === 'bool'"
      :model-value="Boolean(modelValue)"
      @change="updateValue"
    />

    <el-input-number
      v-else-if="field.type === 'int' || field.type === 'float'"
      :model-value="numberValue"
      :min="field.min"
      :max="field.max"
      :step="field.type === 'float' ? 0.1 : 1"
      controls-position="right"
      class="full-control"
      @change="updateValue(Number($event || 0))"
    />

    <div v-else-if="field.type === 'color'" class="color-control">
      <el-color-picker :model-value="String(modelValue || '#000000')" @change="updateValue" />
      <el-input :model-value="String(modelValue || '')" @input="updateValue" />
    </div>

    <el-input
      v-else
      :model-value="String(modelValue ?? '')"
      :type="isLongText ? 'textarea' : 'text'"
      :rows="isLongText ? 3 : undefined"
      :placeholder="placeholder || field.name"
      @input="updateValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { defaultValueForField } from '../sectionSamples';
import type { DebugSectionDisplayField } from '../types';

defineOptions({ name: 'SchemaFieldInput' });

const props = withDefaults(defineProps<{
  field: DebugSectionDisplayField;
  modelValue: unknown;
  placeholder?: string;
  nested?: boolean;
}>(), {
  placeholder: '',
  nested: false
});

const emit = defineEmits<{(event: 'update:modelValue', value: unknown): void;}>();
const arrayValue = computed(() => Array.isArray(props.modelValue) ? props.modelValue : []);
const objectValue = computed(() => asRecord(props.modelValue));
const numberValue = computed(() => Number(props.modelValue || 0));
const isLongText = computed(() => ['body', 'description', 'content', 'subtitle'].includes(props.field.name));
const arrayItemField = computed<DebugSectionDisplayField>(() => ({
  name: 'value',
  type: inferArrayItemType(),
  label: props.field.label || props.field.name,
  default: inferArrayItemType() === 'int' ? 0 : '',
  required: false,
  options: [],
  min: props.field.min,
  max: props.field.max,
  children: []
}));

function updateValue(value: unknown) {
  emit('update:modelValue', value);
}

function addArrayItem() {
  const next = cloneArray();
  if (props.field.children.length) {
    next.push(props.field.children.reduce<Record<string, unknown>>((item, child) => {
      item[child.name] = defaultValueForField(child);
      return item;
    }, {}));
  } else {
    next.push(defaultValueForField(arrayItemField.value));
  }
  updateValue(next);
}

function removeArrayItem(index: number) {
  const next = cloneArray();
  next.splice(index, 1);
  updateValue(next);
}

function setArrayItem(index: number, value: unknown) {
  const next = cloneArray();
  next[index] = value;
  updateValue(next);
}

function setArrayChild(index: number, name: string, value: unknown) {
  const next = cloneArray();
  next[index] = { ...asRecord(next[index]), [name]: value };
  updateValue(next);
}

function setObjectChild(name: string, value: unknown) {
  updateValue({ ...objectValue.value, [name]: value });
}

function cloneArray() {
  return arrayValue.value.map((item) => {
    return typeof item === 'object' && item !== null ? { ...asRecord(item) } : item;
  });
}

function inferArrayItemType() {
  const first = arrayValue.value[0];
  if (typeof first === 'number') return Number.isInteger(first) ? 'int' : 'float';
  if (typeof first === 'boolean') return 'bool';
  if (/point|value|number|count/i.test(props.field.name) || /数值|整数|数字|int/i.test(props.field.label)) return 'int';
  return 'string';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
</script>

<style scoped>
.schema-input,
.full-control {
  width: 100%;
}

.array-list,
.object-fields,
.child-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.array-item {
  padding: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.array-item-head {
  min-height: 24px;
  margin-bottom: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.array-item-head > span {
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.child-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.child-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.child-field > span {
  color: #475569;
  font-size: 11px;
  font-weight: 500;
}

.child-field i {
  margin-left: 3px;
  color: #ef4444;
  font-style: normal;
}

.add-item-button {
  width: 100%;
  border-style: dashed;
  color: #4f6f9f;
}

.plus {
  margin-right: 4px;
  font-size: 16px;
}

.object-fields {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.schema-empty {
  padding: 16px;
  color: #94a3b8;
  font-size: 11px;
  text-align: center;
}

.color-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
}

@media (max-width: 640px) {
  .child-grid {
    grid-template-columns: 1fr;
  }
}
</style>
