<template>
  <el-card shadow="never" class="panel-card">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">Workspace 编辑器</div>
          <div class="panel-subtitle">左侧维护 editorDraft，保存或 patch 后再从后端刷新真实 state。</div>
        </div>
      </div>
    </template>

    <div class="stack-gap">
      <el-form label-position="top" class="page-form">
        <div class="form-grid">
          <el-form-item label="Layout">
            <el-select :model-value="draft.layout" placeholder="选择布局" @change="setPageField('layout', $event)">
              <el-option v-for="layout in layouts" :key="layout" :label="layout" :value="layout" />
            </el-select>
          </el-form-item>
          <el-form-item label="Auto Scroll">
            <el-switch :model-value="draft.autoScroll" @change="setPageField('autoScroll', $event)" />
          </el-form-item>
          <el-form-item label="Auto Scroll Ms">
            <el-input-number
              :model-value="draft.autoScrollMs"
              :min="0"
              :step="100"
              style="width: 100%"
              @change="setPageField('autoScrollMs', Number($event || 0))"
            />
          </el-form-item>
        </div>
      </el-form>

      <div class="toolbar-row">
        <div class="toolbar-group">
          <el-select v-model="newSectionType" placeholder="新增 section 类型" style="min-width: 220px">
            <el-option
              v-for="type in addableSectionTypes"
              :key="type.type"
              :label="getSectionSemantic(type.type).title"
              :value="type.type"
            />
          </el-select>
          <el-button :disabled="!newSectionType" @click="handleAddSection">新增 section</el-button>
        </div>
        <div class="toolbar-group">
          <el-button type="primary" :loading="submitting === 'save'" @click="emit('save-page')">整页保存</el-button>
          <el-button
            v-if="currentSection && canAddCurrent"
            :loading="submitting === 'patch'"
            @click="emit('apply-patch', sectionKey(currentSection), 'add')"
          >
            添加到当前页面
          </el-button>
          <el-button
            v-if="currentSection && canPatchCurrent('update')"
            :loading="submitting === 'patch'"
            @click="emit('apply-patch', sectionKey(currentSection), 'update')"
          >
            应用当前 patch
          </el-button>
          <el-button
            v-if="currentSection && canRemoveCurrent"
            type="danger"
            plain
            :loading="submitting === 'remove'"
            @click="emit('remove-section', sectionKey(currentSection))"
          >
            删除当前 section
          </el-button>
        </div>
      </div>

      <div class="editor-grid">
        <div class="section-list">
          <article
            v-for="section in draft.sections"
            :key="sectionKey(section)"
            class="section-pill"
            :class="{ active: sectionKey(section) === selectedSectionId }"
            @click="selectedSectionId = sectionKey(section)"
          >
            <strong>{{ getSectionSemantic(section.sectionType).title }}</strong>
            <span class="muted">{{ section.sectionId || '待后端分配 ID' }}</span>
          </article>
          <el-empty v-if="!draft.sections.length" description="先添加一个 section" :image-size="40" />
        </div>

        <div v-if="currentSection" class="section-editor">
          <div class="section-editor-head">
            <div>
              <div class="block-label">{{ currentSectionSemantic.title }}</div>
              <div class="muted">{{ currentSectionSemantic.summary }}</div>
            </div>
            <el-tag size="small" :type="isPersistedSection(currentSection.sectionId) ? 'success' : 'info'">
              {{ isPersistedSection(currentSection.sectionId) ? '已存在于 workspace' : '仅本地 draft' }}
            </el-tag>
          </div>

          <div class="meta-chips">
            <el-tag size="small" effect="plain">
              pageId {{ draft.pageId || '待后端分配' }}
            </el-tag>
            <el-tag size="small" effect="plain">
              sectionId {{ currentSection.sectionId || '待后端分配' }}
            </el-tag>
          </div>

          <el-form label-position="top" size="small" class="stack-gap">
            <el-form-item
              v-for="field in currentFields"
              :key="`${sectionKey(currentSection)}-${field.name}`"
              :label="getFieldSemantic(currentSection.sectionType, field).label"
            >
              <div v-if="getFieldSemantic(currentSection.sectionType, field).help" class="field-help">
                {{ getFieldSemantic(currentSection.sectionType, field).help }}
              </div>
              <el-switch
                v-if="resolveFieldControl(field) === 'switch'"
                :model-value="Boolean(currentSection.fields[field.name])"
                @change="setCurrentField(field.name, $event)"
              />
              <el-input-number
                v-else-if="resolveFieldControl(field) === 'number'"
                :model-value="coerceNumber(currentSection.fields[field.name])"
                style="width: 100%"
                @change="setCurrentField(field.name, Number($event || 0))"
              />
              <el-input
                v-else-if="resolveFieldControl(field) === 'text'"
                :model-value="stringifyFlatValue(currentSection.fields[field.name])"
                :placeholder="getFieldSemantic(currentSection.sectionType, field).placeholder || field.name"
                @input="setCurrentField(field.name, $event)"
              />
              <el-input
                v-else-if="resolveFieldControl(field) === 'textarea'"
                type="textarea"
                :rows="4"
                :model-value="stringifyFlatValue(currentSection.fields[field.name])"
                :placeholder="getFieldSemantic(currentSection.sectionType, field).placeholder || field.name"
                @input="setCurrentField(field.name, $event)"
              />
              <el-input
                v-else
                type="textarea"
                :rows="4"
                :model-value="stringifyJson(currentSection.fields[field.name])"
                :placeholder="getFieldSemantic(currentSection.sectionType, field).placeholder || 'JSON'"
                @input="setCurrentField(field.name, safeParseJson(String($event || '')))"
              />
            </el-form-item>
          </el-form>
        </div>

        <el-empty v-else description="选择一个 section 开始编辑" :image-size="48" />
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getFieldSemantic, getSectionSemantic, inferControl } from '../sectionSemantics';
import type { DebugSectionDisplayField, DebugSectionEditor, DebugSectionPage, DebugSectionType } from '../types';

const props = defineProps<{
  editorMeta: DebugSectionEditor;
  draft: DebugSectionPage;
  workspacePage: DebugSectionPage | null;
  submitting: '' | 'save' | 'patch' | 'remove';
}>();

const emit = defineEmits<{
  (event: 'change-draft', draft: DebugSectionPage): void;
  (event: 'save-page'): void;
  (event: 'apply-patch', sectionRef: string, op: 'add' | 'update'): void;
  (event: 'remove-section', sectionRef: string): void;
}>();

const selectedSectionId = ref('');
const newSectionType = ref('');

watch(
  () => props.draft.sections,
  (sections) => {
    if (!sections.length) {
      selectedSectionId.value = '';
      return;
    }
    if (!sections.some((item) => sectionKey(item) === selectedSectionId.value)) {
      selectedSectionId.value = sectionKey(sections[0]);
    }
  },
  { immediate: true, deep: true }
);

const layouts = computed(() => props.editorMeta.layouts || []);
const sectionTypeMap = computed(() => {
  return new Map(props.editorMeta.sectionTypes.map((item) => [item.type, item]));
});
const addableSectionTypes = computed(() => {
  return props.editorMeta.sectionTypes.filter((item) => item.patchOps.includes('add') || item.patchOps.length === 0);
});
const currentSection = computed(() => {
  return props.draft.sections.find((item) => sectionKey(item) === selectedSectionId.value) || null;
});
const currentFields = computed<DebugSectionDisplayField[]>(() => {
  const type = currentSection.value?.sectionType || '';
  return sectionTypeMap.value.get(type)?.displayFields || [];
});
const currentSectionSemantic = computed(() => {
  return getSectionSemantic(currentSection.value?.sectionType || '');
});
const canRemoveCurrent = computed(() => {
  if (!currentSection.value) return false;
  const typeMeta = sectionTypeMap.value.get(currentSection.value.sectionType);
  return !typeMeta || typeMeta.patchOps.includes('remove') || !isPersistedSection(currentSection.value.sectionId);
});
const canAddCurrent = computed(() => {
  if (!currentSection.value || !props.workspacePage) return false;
  const typeMeta = sectionTypeMap.value.get(currentSection.value.sectionType);
  return !isPersistedSection(currentSection.value.sectionId) && (!typeMeta || typeMeta.patchOps.includes('add') || typeMeta.patchOps.length === 0);
});

function cloneDraft() {
  return {
    ...props.draft,
    sections: props.draft.sections.map((section) => ({
      ...section,
      fields: JSON.parse(JSON.stringify(section.fields || {}))
    }))
  };
}

function handleAddSection() {
  const typeMeta = sectionTypeMap.value.get(newSectionType.value);
  if (!typeMeta) return;
  const next = cloneDraft();
  const draftKey = sectionKey();
  next.sections.push({
    sectionId: '',
    sectionType: typeMeta.type,
    fields: buildEmptyFields(typeMeta),
    draftKey
  });
  emit('change-draft', next);
  selectedSectionId.value = draftKey;
}

function setPageField(field: keyof DebugSectionPage, value: unknown) {
  emit('change-draft', {
    ...cloneDraft(),
    [field]: value
  });
}

function setCurrentField(fieldName: string, value: unknown) {
  if (!currentSection.value) return;
  const next = cloneDraft();
  const target = next.sections.find((item) => sectionKey(item) === sectionKey(currentSection.value || undefined));
  if (!target) return;
  target.fields[fieldName] = value;
  emit('change-draft', next);
}

function buildEmptyFields(typeMeta: DebugSectionType) {
  return typeMeta.displayFields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.name] = defaultValueForField(field);
    return acc;
  }, {});
}

function defaultValueForField(field: DebugSectionDisplayField): unknown {
  if (field.children.length) return {};
  if (field.type === 'bool') return false;
  if (field.type === 'int' || field.type === 'float') return 0;
  return '';
}

function isPersistedSection(sectionId: string) {
  return !!props.workspacePage?.sections.some((item) => item.sectionId === sectionId);
}

function canPatchCurrent(op: 'update') {
  if (!currentSection.value) return false;
  const typeMeta = sectionTypeMap.value.get(currentSection.value.sectionType);
  return !!currentSection.value.sectionId && isPersistedSection(currentSection.value.sectionId) && (!typeMeta || typeMeta.patchOps.includes(op));
}

function sectionKey(section?: { sectionId?: string; draftKey?: string }) {
  if (!section) {
    return `draft_${Math.random().toString(36).slice(2, 10)}`;
  }
  return section.draftKey || section.sectionId || `draft_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0);
}

function stringifyFlatValue(value: unknown) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function stringifyJson(value: unknown) {
  if (value == null || value === '') return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolveFieldControl(field: DebugSectionDisplayField) {
  return getFieldSemantic(currentSection.value?.sectionType || '', field).control || inferControl(field);
}
</script>

<style scoped>
.stack-gap,
.page-form,
.section-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header,
.toolbar-row,
.toolbar-group,
.section-editor-head,
.meta-chips {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title,
.block-label {
  font-weight: 700;
}

.field-help {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.panel-subtitle,
.muted {
  color: #6b7280;
}

.form-grid,
.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.section-list,
.section-editor {
  min-height: 320px;
}

.section-list {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-pill {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #dbe4f0;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.section-pill.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.section-editor {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  background: #fff;
}

@media (max-width: 960px) {
  .form-grid,
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
