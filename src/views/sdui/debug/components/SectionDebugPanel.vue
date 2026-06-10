<template>
  <div class="section-panel">
    <div class="toolbar-row">
      <div class="toolbar-group">
        <el-tag :type="editorMeta.online ? 'success' : 'info'" round>
          {{ editorMeta.online ? '设备在线' : '设备离线' }}
        </el-tag>
        <el-tag effect="plain">renderMode {{ editorMeta.renderMode || '-' }}</el-tag>
        <el-tag effect="plain">sizeClass {{ editorMeta.sizeClass || '-' }}</el-tag>
      </div>
      <div class="toolbar-group">
        <el-button :loading="loadingState === 'refresh'" @click="refreshData">刷新</el-button>
        <el-button type="danger" plain :loading="loadingState === 'clear'" @click="clearWorkspace">清空 workspace</el-button>
      </div>
    </div>

    <div class="section-grid">
      <div class="stack-gap">
        <SectionWorkspaceEditor
          :editor-meta="editorMeta"
          :draft="editorDraft"
          :workspace-page="activeWorkspacePage"
          :submitting="editorSubmittingState"
          @change-draft="editorDraft = $event"
          @save-page="savePage"
          @apply-patch="applyPatch"
          @remove-section="removeSection"
        />
      </div>

      <div class="stack-gap">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">Workspace 状态</div>
                <div class="panel-subtitle">真实渲染源来自后端维护的 debug workspace。</div>
              </div>
              <el-tag size="small">{{ workspaceState.activePageId || 'no-active-page' }}</el-tag>
            </div>
          </template>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="Pages">{{ workspaceState.pages.length }}</el-descriptions-item>
            <el-descriptions-item label="Active Page">{{ activeWorkspacePage?.pageId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Sections">{{ activeWorkspacePage?.sections.length || 0 }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <SectionPreviewCanvas :page="activeWorkspacePage" @preview-event="handlePreviewEvent" />
        <SectionEventLog :events="previewEvents" @clear="previewEvents = []" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  clearDebugSectionState,
  getDebugSectionEditor,
  getDebugSectionState,
  patchDebugSection,
  sendDebugSection
} from '@/api/sdui';
import {
  buildSingleSectionPatch,
  cloneSectionPage,
  createDraftKey,
  normalizeSectionEditor,
  normalizeSectionPreviewEvent,
  normalizeSectionWorkspaceState
} from '../normalize';
import type { DebugSectionEditor, DebugSectionPage, DebugSectionPreviewEvent, DebugSectionWorkspaceState } from '../types';
import SectionEventLog from './SectionEventLog.vue';
import SectionPreviewCanvas from './SectionPreviewCanvas.vue';
import SectionWorkspaceEditor from './SectionWorkspaceEditor.vue';

const props = defineProps<{
  deviceId: string;
}>();

const emit = defineEmits<{
  (event: 'summary-change', payload: { sectionTypeCount: number; pageCount: number; activeSectionCount: number }): void;
}>();

const editorMeta = ref<DebugSectionEditor>({
  deviceId: '',
  online: false,
  renderMode: 'rich',
  sizeClass: '',
  layouts: [],
  sectionTypes: []
});
const workspaceState = ref<DebugSectionWorkspaceState>({
  deviceId: '',
  online: false,
  activePageId: null,
  pages: []
});
const editorDraft = ref<DebugSectionPage>({
  pageId: '',
  layout: 'vertical_scroll',
  autoScroll: false,
  autoScrollMs: 0,
  sections: []
});
const previewEvents = ref<DebugSectionPreviewEvent[]>([]);
const loadingState = ref<'' | 'refresh' | 'clear'>('');
const editorSubmittingState = ref<'' | 'save' | 'patch' | 'remove'>('');

const activeWorkspacePage = computed(() => {
  if (!workspaceState.value.activePageId) return workspaceState.value.pages[0] || null;
  return workspaceState.value.pages.find((item) => item.pageId === workspaceState.value.activePageId) || workspaceState.value.pages[0] || null;
});

watch(
  [editorMeta, workspaceState],
  () => {
    emit('summary-change', {
      sectionTypeCount: editorMeta.value.sectionTypes.length,
      pageCount: workspaceState.value.pages.length,
      activeSectionCount: activeWorkspacePage.value?.sections.length || 0
    });
  },
  { immediate: true, deep: true }
);

watch(
  () => props.deviceId,
  () => {
    previewEvents.value = [];
  }
);

async function refreshData() {
  if (!props.deviceId) return;
  loadingState.value = 'refresh';
  try {
    const [editorResponse, stateResponse] = await Promise.all([
      getDebugSectionEditor(props.deviceId),
      getDebugSectionState(props.deviceId)
    ]);
    editorMeta.value = normalizeSectionEditor(editorResponse);
    workspaceState.value = normalizeSectionWorkspaceState(stateResponse);
    syncDraftFromWorkspace();
  } catch (error: any) {
    ElMessage.error(error?.message || '加载 Section 调试数据失败');
  } finally {
    loadingState.value = '';
  }
}

function syncDraftFromWorkspace() {
  editorDraft.value = cloneSectionPage(activeWorkspacePage.value);
  if (!editorDraft.value.layout) {
    editorDraft.value.layout = editorMeta.value.layouts[0] || 'vertical_scroll';
  }
}

function validateDraft() {
  if (!editorDraft.value.layout) return 'layout 不能为空';
  if (!editorDraft.value.sections.length) return '至少需要一个 section';
  const ids = editorDraft.value.sections.map((item) => item.sectionId).filter(Boolean);
  if (new Set(ids).size !== ids.length) return 'sectionId 不能重复';
  return '';
}

async function savePage() {
  const errorText = validateDraft();
  if (errorText) {
    ElMessage.warning(errorText);
    return;
  }
  editorSubmittingState.value = 'save';
  try {
    await sendDebugSection(props.deviceId, {
      ...(editorDraft.value.pageId ? { pageId: editorDraft.value.pageId } : {}),
      layout: editorDraft.value.layout,
      autoScroll: editorDraft.value.autoScroll,
      autoScrollMs: editorDraft.value.autoScrollMs,
      sections: editorDraft.value.sections.map((item) => ({
        ...(item.sectionId ? { sectionId: item.sectionId } : {}),
        sectionType: item.sectionType,
        fields: item.fields
      }))
    });
    ElMessage.success('页面已保存');
    await refreshData();
  } catch (error: any) {
    ElMessage.error(error?.message || '整页保存失败');
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function applyPatch(sectionRef: string, op: 'add' | 'update') {
  const section = editorDraft.value.sections.find((item) => (item.draftKey || item.sectionId) === sectionRef);
  if (!section) return;
  editorSubmittingState.value = 'patch';
  try {
    const patchPayload = buildSingleSectionPatch(section, op);
    await patchDebugSection(props.deviceId, {
      ...((op === 'update' || op === 'remove') && editorDraft.value.pageId ? { pageId: editorDraft.value.pageId } : {}),
      patches: [patchPayload]
    });
    ElMessage.success(op === 'add' ? 'Section 已添加到当前 active page' : 'Patch 已应用');
    await refreshData();
  } catch (error: any) {
    ElMessage.error(error?.message || 'Patch 失败');
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function removeSection(sectionRef: string) {
  const section = editorDraft.value.sections.find((item) => (item.draftKey || item.sectionId) === sectionRef);
  if (!section) return;
  const persisted = !!section.sectionId && !!activeWorkspacePage.value?.sections.some((item) => item.sectionId === section.sectionId);
  if (!persisted) {
    editorDraft.value = {
      ...editorDraft.value,
      sections: editorDraft.value.sections.filter((item) => (item.draftKey || item.sectionId) !== sectionRef)
    };
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除 section ${section.sectionId}？`, '删除确认', {
      type: 'warning'
    });
  } catch {
    return;
  }

  editorSubmittingState.value = 'remove';
  try {
    await patchDebugSection(props.deviceId, {
      ...(editorDraft.value.pageId ? { pageId: editorDraft.value.pageId } : {}),
      patches: [buildSingleSectionPatch(section, 'remove')]
    });
    ElMessage.success('Section 已删除');
    await refreshData();
  } catch (error: any) {
    ElMessage.error(error?.message || '删除 section 失败');
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function clearWorkspace() {
  try {
    await ElMessageBox.confirm('确认清空当前设备的 Section workspace？', '清空确认', {
      type: 'warning'
    });
  } catch {
    return;
  }

  loadingState.value = 'clear';
  try {
    await clearDebugSectionState(props.deviceId);
    workspaceState.value = {
      deviceId: props.deviceId,
      online: editorMeta.value.online,
      activePageId: null,
      pages: []
    };
    editorDraft.value = cloneSectionPage(null);
    editorDraft.value.layout = editorMeta.value.layouts[0] || 'vertical_scroll';
    editorDraft.value.sections = [];
    previewEvents.value = [];
    ElMessage.success('Workspace 已清空');
  } catch (error: any) {
    ElMessage.error(error?.message || '清空 workspace 失败');
    await refreshStateOnly();
  } finally {
    loadingState.value = '';
  }
}

async function refreshStateOnly() {
  try {
    const stateResponse = await getDebugSectionState(props.deviceId);
    workspaceState.value = normalizeSectionWorkspaceState(stateResponse);
    syncDraftFromWorkspace();
    editorDraft.value.sections = editorDraft.value.sections.map((item) => ({
      ...item,
      draftKey: item.draftKey || createDraftKey(item.sectionId || 'section')
    }));
  } catch {
    // keep previous error message
  }
}

function handlePreviewEvent(payload: { eventName: string; pageId: string; sectionId: string; payload: Record<string, unknown> }) {
  previewEvents.value = [
    normalizeSectionPreviewEvent(payload.eventName, payload.pageId, payload.sectionId, payload.payload),
    ...previewEvents.value
  ].slice(0, 100);
}

defineExpose({
  refreshData
});
</script>

<style scoped>
.section-panel,
.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.toolbar-row,
.toolbar-group,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  font-weight: 700;
}

.panel-subtitle {
  color: #6b7280;
}

@media (max-width: 1080px) {
  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
