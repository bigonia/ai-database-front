<template>
  <el-card shadow="never" class="panel-card workspace-card">
    <template #header>
      <div class="panel-header">
        <div class="panel-heading">
          <div class="panel-title">{{ panelTitle }}</div>
          <div v-if="showDeviceMeta" class="device-meta">
            <span class="device-state" :class="{ online: editorMeta.online }">
              <i />
              {{ editorMeta.online ? '设备在线' : '设备离线' }}
            </span>
            <span class="device-divider" />
            <span class="device-detail"><em>渲染模式</em><strong>{{ editorMeta.renderMode || '-' }}</strong></span>
            <span class="device-detail"><em>设备尺寸</em><strong>{{ editorMeta.sizeClass || '-' }}</strong></span>
            <el-tooltip content="刷新设备信息" placement="top">
              <el-button
                class="refresh-action"
                text
                :icon="Refresh"
                :loading="refreshing"
                aria-label="刷新设备信息"
                @click="emit('refresh')"
              />
            </el-tooltip>
          </div>
        </div>
        <div class="header-config">
          <label class="inline-config">
            <span>页面布局</span>
            <el-select :model-value="draft.layout" size="small" placeholder="选择布局" @change="setPageField('layout', $event)">
              <el-option v-for="layout in layouts" :key="layout" :label="layoutLabel(layout)" :value="layout" />
            </el-select>
          </label>
          <label class="inline-config">
            <span>滚动间隔</span>
            <el-input-number
              :model-value="scrollIntervalSeconds"
              :min="0"
              :step="1"
              :precision="0"
              size="small"
              controls-position="right"
              @change="setScrollInterval($event)"
            />
            <em>秒</em>
          </label>
          <span class="scroll-hint">{{ scrollIntervalSeconds > 0 ? '自动滚动' : '不滚动' }}</span>
          <el-button
            v-if="mode === 'definition'"
            type="primary"
            :loading="submitting === 'save'"
            @click="emit('save-page')"
          >
            {{ savePageLabel }}
          </el-button>
        </div>
      </div>
    </template>

    <div class="stack-gap">
      <div class="editor-grid">
        <SectionCatalog :types="addableSectionTypes" @add="handleAddSection" />

        <div class="section-sidebar">
          <div class="sidebar-heading">
            <div class="sidebar-title">
              <span>已添加内容</span>
              <el-tag size="small" type="info">{{ draft.sections.length }}</el-tag>
            </div>
            <div class="sidebar-actions">
              <el-tooltip content="全部保存" placement="top">
                <el-button
                  class="icon-action"
                  type="primary"
                  text
                  :icon="DocumentChecked"
                  :loading="submitting === 'save'"
                  :disabled="!draft.sections.length || !!submitting"
                  aria-label="全部保存"
                  @click="emit('save-page')"
                />
              </el-tooltip>
              <el-tooltip content="全部清除" placement="top">
                <el-button
                  class="icon-action danger"
                  text
                  :icon="Delete"
                  :loading="submitting === 'remove'"
                  :disabled="!draft.sections.length || !!submitting"
                  aria-label="全部清除"
                  @click="emit('clear-sections')"
                />
              </el-tooltip>
            </div>
          </div>
          <div v-if="isOrderDirty" class="order-warning">
            <el-icon><WarningFilled /></el-icon>
            <span>顺序已调整，请使用“全部保存”提交</span>
          </div>
          <div class="section-list">
            <div
              v-for="(section, index) in draft.sections"
              :key="sectionKey(section)"
              class="section-pill"
              :class="[
                `is-${sectionStatus(section)}`,
                {
                  active: sectionKey(section) === selectedSectionId,
                  dragging: dragSectionKey === sectionKey(section),
                  'drop-before': dropTargetKey === sectionKey(section) && dropPosition === 'before',
                  'drop-after': dropTargetKey === sectionKey(section) && dropPosition === 'after'
                }
              ]"
              @dragover.prevent="handleDragOver($event, section)"
              @drop.prevent="handleDrop(section)"
            >
              <el-tooltip content="拖拽调整顺序" placement="top">
                <span
                  class="drag-handle"
                  draggable="true"
                  role="button"
                  tabindex="0"
                  aria-label="拖拽调整顺序"
                  @dragstart="handleDragStart($event, section)"
                  @dragend="resetDragState"
                >
                  <el-icon><Rank /></el-icon>
                </span>
              </el-tooltip>
              <button type="button" class="section-pill-main" @click="selectedSectionId = sectionKey(section)">
                <span class="section-index">{{ index + 1 }}</span>
                <span class="section-pill-copy">
                  <strong>{{ getSectionSemantic(section.sectionType).title }}</strong>
                  <small>{{ section.sectionId || '待后端分配 ID' }}</small>
                </span>
              </button>
              <span class="section-status" :class="`is-${sectionStatus(section)}`">
                {{ sectionStatusLabel(section) }}
              </span>
              <span class="section-item-actions">
                <el-tooltip :content="isOrderDirty ? '顺序调整后必须使用全部保存' : '保存当前 Section'" placement="top">
                  <el-button
                    class="item-icon-action"
                    type="primary"
                    text
                    :icon="Check"
                    :loading="submitting === 'patch' && sectionKey(section) === selectedSectionId"
                    :disabled="!canSaveSection(section) || !!submitting"
                    aria-label="保存当前 Section"
                    @click="saveSection(section)"
                  />
                </el-tooltip>
                <el-tooltip
                  :content="isOrderDirty && isPersistedSection(section.sectionId) ? '顺序调整后请先全部保存' : '删除当前 Section'"
                  placement="top"
                >
                  <el-button
                    class="item-icon-action danger"
                    text
                    :icon="Delete"
                    :loading="submitting === 'remove' && sectionKey(section) === selectedSectionId"
                    :disabled="!canRemoveSection(section) || !!submitting"
                    aria-label="删除当前 Section"
                    @click="removeSection(section)"
                  />
                </el-tooltip>
              </span>
            </div>
            <el-empty v-if="!draft.sections.length" description="暂无内容" :image-size="40" />
          </div>
        </div>

        <div v-if="currentSection" class="section-editor">
          <div class="section-editor-head">
            <div>
              <div class="block-label">{{ currentSectionSemantic.title }}</div>
              <div class="muted">{{ currentSectionSemantic.summary }}</div>
            </div>
            <el-tag size="small" :type="sectionStatusTagType(currentSection)">
              {{ sectionStatusLabel(currentSection) }}
            </el-tag>
          </div>

          <div class="meta-chips">
            <el-tag size="small" effect="plain">
              sectionId {{ currentSection.sectionId || '待后端分配' }}
            </el-tag>
          </div>

          <el-form label-position="top" size="small" class="stack-gap">
            <el-form-item
              v-for="field in currentFields"
              :key="`${sectionKey(currentSection)}-${field.name}`"
              :label="field.label || getFieldSemantic(currentSection.sectionType, field).label"
            >
              <div v-if="getFieldSemantic(currentSection.sectionType, field).help" class="field-help">
                {{ getFieldSemantic(currentSection.sectionType, field).help }}
              </div>
              <SchemaFieldInput
                :field="field"
                :model-value="currentSection.fields[field.name]"
                :placeholder="getFieldSemantic(currentSection.sectionType, field).placeholder"
                @update:model-value="setCurrentField(field.name, $event)"
              />
            </el-form-item>
          </el-form>
        </div>

        <div v-else class="editor-empty">
          <div class="empty-illustration"><span>＋</span></div>
          <strong>从组件库添加内容</strong>
          <p>点击左侧任意样例卡片，即可在这里设置参数。</p>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Delete, DocumentChecked, Rank, Refresh, WarningFilled } from '@element-plus/icons-vue';
import { getFieldSemantic, getSectionSemantic } from '../sectionSemantics';
import { buildSectionFields } from '../sectionSamples';
import type { DebugSectionDisplayField, DebugSectionEditor, DebugSectionPage, DebugSectionType } from '../types';
import SchemaFieldInput from './SchemaFieldInput.vue';
import SectionCatalog from './SectionCatalog.vue';

const props = defineProps<{
  editorMeta: DebugSectionEditor;
  draft: DebugSectionPage;
  workspacePage: DebugSectionPage | null;
  submitting: '' | 'save' | 'patch' | 'remove';
  mode?: 'workspace' | 'definition';
  panelTitle?: string;
  savePageLabel?: string;
  persistedSectionLabel?: string;
  localSectionLabel?: string;
  refreshing?: boolean;
}>();

const emit = defineEmits<{(event: 'change-draft', draft: DebugSectionPage): void;
  (event: 'save-page'): void;
  (event: 'apply-patch', sectionRef: string, op: 'add' | 'update'): void;
  (event: 'remove-section', sectionRef: string): void;
  (event: 'clear-sections'): void;
  (event: 'refresh'): void;
  (event: 'save-page-settings', settings: Pick<DebugSectionPage, 'layout' | 'autoScroll' | 'autoScrollMs'>): void;
}>();

const selectedSectionId = ref('');
const dragSectionKey = ref('');
const dropTargetKey = ref('');
const dropPosition = ref<'before' | 'after'>('before');
const orderChangedLocally = ref(false);
let pageSettingsSaveTimer: ReturnType<typeof setTimeout> | undefined;

const panelTitle = computed(() => props.panelTitle || (props.mode === 'definition' ? 'Page 设计器' : 'UI 编辑器'));
const savePageLabel = computed(() => props.savePageLabel || '整页保存');
const persistedSectionLabel = computed(() => props.persistedSectionLabel || '已保存');
const localSectionLabel = computed(() => props.localSectionLabel || '未保存');
const showPatchActions = computed(() => props.mode !== 'definition');
const showDeviceMeta = computed(() => props.mode !== 'definition');

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

watch(
  () => props.workspacePage,
  () => {
    orderChangedLocally.value = false;
  }
);

const layouts = computed(() => props.editorMeta.layouts || []);
const scrollIntervalSeconds = computed(() => Math.max(0, Math.round(Number(props.draft.autoScrollMs || 0) / 1000)));
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
const isOrderDirty = computed(() => {
  if (!showPatchActions.value || !props.workspacePage) return false;
  const persistedIds = props.workspacePage.sections.map((item) => item.sectionId);
  const draftPersistedIds = props.draft.sections
    .map((item) => item.sectionId)
    .filter((sectionId) => persistedIds.includes(sectionId));
  const orderDiffers = draftPersistedIds.length === persistedIds.length &&
    draftPersistedIds.some((sectionId, index) => sectionId !== persistedIds[index]);
  return orderChangedLocally.value || orderDiffers;
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

function handleAddSection(typeMeta: DebugSectionType) {
  const next = cloneDraft();
  const draftKey = sectionKey();
  next.sections.push({
    sectionId: '',
    sectionType: typeMeta.type,
    fields: buildSectionFields(typeMeta),
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
  schedulePageSettingsSave();
}

function setScrollInterval(value: number | undefined) {
  const seconds = Math.max(0, Math.round(Number(value || 0)));
  emit('change-draft', {
    ...cloneDraft(),
    autoScroll: seconds > 0,
    autoScrollMs: seconds * 1000
  });
  schedulePageSettingsSave();
}

function schedulePageSettingsSave() {
  if (props.mode === 'definition') return;
  if (pageSettingsSaveTimer) clearTimeout(pageSettingsSaveTimer);
  pageSettingsSaveTimer = setTimeout(async () => {
    await nextTick();
    emit('save-page-settings', {
      layout: props.draft.layout,
      autoScroll: props.draft.autoScroll,
      autoScrollMs: props.draft.autoScrollMs
    });
  }, 500);
}

function layoutLabel(layout: string) {
  return ({
    vertical_scroll: '纵向滚动',
    horizontal_pages: '横向分页',
    fixed_single: '固定单页',
    overlay: '浮层布局'
  } as Record<string, string>)[layout] || layout;
}

function setCurrentField(fieldName: string, value: unknown) {
  if (!currentSection.value) return;
  const next = cloneDraft();
  const target = next.sections.find((item) => sectionKey(item) === sectionKey(currentSection.value || undefined));
  if (!target) return;
  target.fields[fieldName] = value;
  emit('change-draft', next);
}

function isPersistedSection(sectionId: string) {
  return !!props.workspacePage?.sections.some((item) => item.sectionId === sectionId);
}

type SectionStatus = 'saved' | 'pending' | 'local';

function sectionStatus(section: DebugSectionPage['sections'][number]): SectionStatus {
  const persisted = props.workspacePage?.sections.find((item) => item.sectionId === section.sectionId);
  if (!persisted) return 'local';
  return stableSerialize({
    sectionType: section.sectionType,
    fields: section.fields
  }) !== stableSerialize({
    sectionType: persisted.sectionType,
    fields: persisted.fields
  }) ? 'pending' : 'saved';
}

function sectionStatusLabel(section: DebugSectionPage['sections'][number]) {
  const status = sectionStatus(section);
  if (status === 'saved') return persistedSectionLabel.value;
  if (status === 'pending') return '未提交';
  return localSectionLabel.value;
}

function sectionStatusTagType(section: DebugSectionPage['sections'][number]) {
  const status = sectionStatus(section);
  if (status === 'saved') return 'success';
  if (status === 'pending') return 'warning';
  return 'info';
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function canSaveSection(section: DebugSectionPage['sections'][number]) {
  if (!showPatchActions.value) return true;
  const typeMeta = sectionTypeMap.value.get(section.sectionType);
  if (isPersistedSection(section.sectionId)) {
    return !!section.sectionId && (!typeMeta || typeMeta.patchOps.includes('update'));
  }
  return !!props.workspacePage && (!typeMeta || typeMeta.patchOps.includes('add') || typeMeta.patchOps.length === 0);
}

function canRemoveSection(section: DebugSectionPage['sections'][number]) {
  const typeMeta = sectionTypeMap.value.get(section.sectionType);
  return !typeMeta || typeMeta.patchOps.includes('remove') || !isPersistedSection(section.sectionId);
}

function saveSection(section: DebugSectionPage['sections'][number]) {
  selectedSectionId.value = sectionKey(section);
  if (isOrderDirty.value) {
    ElMessage.warning('Section 顺序已调整，请使用“全部保存”统一提交');
    return;
  }
  if (!showPatchActions.value) {
    emit('save-page');
    return;
  }
  emit('apply-patch', sectionKey(section), isPersistedSection(section.sectionId) ? 'update' : 'add');
}

function removeSection(section: DebugSectionPage['sections'][number]) {
  selectedSectionId.value = sectionKey(section);
  if (isOrderDirty.value && isPersistedSection(section.sectionId)) {
    ElMessage.warning('Section 顺序已调整，请先使用“全部保存”提交');
    return;
  }
  emit('remove-section', sectionKey(section));
}

function handleDragStart(event: DragEvent, section: DebugSectionPage['sections'][number]) {
  dragSectionKey.value = sectionKey(section);
  selectedSectionId.value = sectionKey(section);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragSectionKey.value);
  }
}

function handleDragOver(event: DragEvent, section: DebugSectionPage['sections'][number]) {
  if (!dragSectionKey.value || dragSectionKey.value === sectionKey(section)) {
    dropTargetKey.value = '';
    return;
  }
  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  dropTargetKey.value = sectionKey(section);
  dropPosition.value = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function handleDrop(targetSection: DebugSectionPage['sections'][number]) {
  const sourceKey = dragSectionKey.value;
  const targetKey = sectionKey(targetSection);
  if (!sourceKey || sourceKey === targetKey) {
    resetDragState();
    return;
  }

  const next = cloneDraft();
  const sourceIndex = next.sections.findIndex((item) => sectionKey(item) === sourceKey);
  const targetIndex = next.sections.findIndex((item) => sectionKey(item) === targetKey);
  if (sourceIndex < 0 || targetIndex < 0) {
    resetDragState();
    return;
  }

  const [moved] = next.sections.splice(sourceIndex, 1);
  let insertIndex = next.sections.findIndex((item) => sectionKey(item) === targetKey);
  if (dropPosition.value === 'after') insertIndex += 1;
  next.sections.splice(insertIndex, 0, moved);
  orderChangedLocally.value = true;
  emit('change-draft', next);
  resetDragState();
}

function resetDragState() {
  dragSectionKey.value = '';
  dropTargetKey.value = '';
  dropPosition.value = 'before';
}

onBeforeUnmount(() => {
  if (pageSettingsSaveTimer) clearTimeout(pageSettingsSaveTimer);
});

function sectionKey(section?: { sectionId?: string; draftKey?: string }) {
  if (!section) {
    return `draft_${Math.random().toString(36).slice(2, 10)}`;
  }
  return section.draftKey || section.sectionId || `draft_${Math.random().toString(36).slice(2, 10)}`;
}

</script>

<style scoped>
.stack-gap,
.section-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.workspace-card {
  container-type: inline-size;
  container-name: workspace;
  border-radius: 14px;
  border-color: #e2e8f0;
  background: #fff;
}

.workspace-card :deep(.el-card__header) {
  padding: 16px 18px 14px;
}

.workspace-card :deep(.el-card__body) {
  padding: 14px 18px 18px;
}

.panel-header,
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

.muted {
  color: #6b7280;
}

.panel-heading {
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1 1 auto;
  flex-wrap: nowrap;
}

.device-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: #475569;
  font-size: 11px;
}

.device-state,
.device-detail {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.device-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, .13);
}

.device-state.online i {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, .13);
}

.device-detail em {
  color: #94a3b8;
  font-style: normal;
}

.device-detail strong {
  color: #475569;
  font-size: 11px;
  font-weight: 600;
}

.device-divider {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
}

.refresh-action {
  width: 26px;
  height: 26px;
  margin: 0 !important;
  padding: 0;
  color: #64748b;
}

.header-config {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.inline-config {
  display: flex;
  align-items: center;
  gap: 7px;
}

.inline-config > span,
.inline-config em {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
}

.inline-config :deep(.el-select) {
  width: 140px;
}

.inline-config :deep(.el-input-number) {
  width: 105px;
}

.scroll-hint {
  padding: 4px 7px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  white-space: nowrap;
}

.editor-grid {
  --editor-column-height: 700px;
  display: grid;
  grid-template-columns: 220px 280px minmax(360px, 1fr);
  align-items: stretch;
  gap: 12px;
}

.editor-grid :deep(.catalog),
.section-sidebar,
.section-editor,
.editor-empty {
  box-sizing: border-box;
  height: var(--editor-column-height);
  min-height: var(--editor-column-height);
}

.editor-grid :deep(.catalog-list) {
  min-height: 0;
  max-height: none;
  flex: 1;
}

.section-sidebar {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.sidebar-title,
.sidebar-actions,
.section-item-actions {
  display: flex;
  align-items: center;
}

.sidebar-title {
  min-width: 0;
  gap: 7px;
}

.sidebar-actions {
  flex: 0 0 auto;
  gap: 2px;
}

.order-warning {
  min-height: 34px;
  padding: 7px 10px;
  border-bottom: 1px solid #fde7b2;
  background: #fffbeb;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b45309;
  font-size: 10px;
  line-height: 1.4;
}

.order-warning :deep(.el-icon) {
  flex: 0 0 auto;
  color: #f59e0b;
  font-size: 13px;
}

.icon-action,
.item-icon-action {
  margin: 0 !important;
  border-radius: 7px;
}

.icon-action {
  width: 26px;
  height: 26px;
  padding: 0;
}

.icon-action.danger,
.item-icon-action.danger {
  color: #ef4444;
}

.section-list {
  min-height: 0;
  max-height: none;
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-pill {
  position: relative;
  width: 100%;
  min-height: 52px;
  padding: 5px 6px 5px 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.section-pill.dragging {
  opacity: .42;
}

.section-pill.drop-before::before,
.section-pill.drop-after::after {
  content: '';
  position: absolute;
  right: 4px;
  left: 4px;
  z-index: 2;
  height: 2px;
  border-radius: 2px;
  background: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, .12);
}

.section-pill.drop-before::before {
  top: -5px;
}

.section-pill.drop-after::after {
  bottom: -5px;
}

.drag-handle {
  width: 18px;
  height: 30px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #94a3b8;
  cursor: grab;
  transition: color .15s ease, background .15s ease;
}

.drag-handle:hover {
  background: #edf2f7;
  color: #475569;
}

.drag-handle:active {
  cursor: grabbing;
}

.section-pill.is-saved {
  border-left: 3px solid #22c55e;
}

.section-pill.is-pending {
  border-color: #f5c56b;
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.section-pill.is-local {
  border-left: 3px solid #94a3b8;
  background: #f8fafc;
}

.section-pill-main {
  min-width: 0;
  flex: 1;
  padding: 5px 2px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 9px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.section-pill.active {
  border-color: #9bbcf8;
  background: #eef5ff;
  box-shadow: 0 3px 10px rgba(37, 99, 235, .08);
}

.section-pill.active.is-pending {
  border-left-color: #f59e0b;
  background: #fff8e7;
}

.section-pill.active.is-local {
  border-left-color: #64748b;
}

.section-index {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #e2e8f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.section-pill.active .section-index {
  background: #2563eb;
  color: #fff;
}

.section-pill-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.section-item-actions {
  flex: 0 0 auto;
  gap: 0;
  opacity: .62;
  transition: opacity .15s ease;
}

.section-status {
  flex: 0 0 auto;
  padding: 2px 5px;
  border-radius: 5px;
  font-size: 9px;
  line-height: 1.4;
  white-space: nowrap;
}

.section-status.is-saved {
  background: #ecfdf3;
  color: #16a34a;
}

.section-status.is-pending {
  background: #fef3c7;
  color: #d97706;
}

.section-status.is-local {
  background: #e2e8f0;
  color: #64748b;
}

.section-pill:hover .section-item-actions,
.section-pill.active .section-item-actions {
  opacity: 1;
}

.item-icon-action {
  width: 24px;
  height: 24px;
  padding: 0;
}

.section-pill-copy strong,
.section-pill-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-pill-copy small {
  color: #64748b;
  font-size: 11px;
}

.section-editor {
  overflow-y: auto;
  padding: 20px 22px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.editor-empty {
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 1px dashed #d8e1ed;
  border-radius: 14px;
  background: #fbfcfe;
  text-align: center;
}

.empty-illustration {
  width: 66px;
  height: 66px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: #edf4ff;
  color: #4f86ed;
  box-shadow: 0 8px 22px rgba(37, 99, 235, .08);
}

.empty-illustration span {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #b8cdf5;
  border-radius: 9px;
  background: #fff;
  font-size: 20px;
}

.editor-empty strong {
  color: #334155;
  font-size: 14px;
}

.editor-empty p {
  margin: 7px 0 0;
  color: #94a3b8;
  font-size: 11px;
}

@container workspace (max-width: 840px) {
  .editor-grid {
    --editor-column-height: 640px;
    grid-template-columns: 280px minmax(320px, 1fr);
  }

  .editor-grid :deep(.catalog) {
    grid-column: 1 / -1;
  }

}

@container workspace (max-width: 680px) {
  .editor-grid {
    --editor-column-height: 560px;
    grid-template-columns: 1fr;
  }

  .section-sidebar {
    height: var(--editor-column-height);
    min-height: var(--editor-column-height);
  }

  .editor-grid :deep(.catalog) {
    justify-self: center;
  }

}

@media (max-width: 640px) {
  .panel-header,
  .editor-toolbar,
  .toolbar-group {
    align-items: stretch;
  }

  .header-config {
    width: 100%;
    justify-content: flex-start;
  }

  .toolbar-group :deep(.el-button) {
    margin-left: 0;
  }
}
</style>
