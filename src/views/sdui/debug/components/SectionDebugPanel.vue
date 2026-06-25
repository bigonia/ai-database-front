<template>
  <div class="section-panel">
    <div class="section-grid">
      <main class="editor-column">
        <SectionWorkspaceEditor
          :editor-meta="editorMeta"
          :draft="editorDraft"
          :workspace-page="persistedPage"
          :submitting="editorSubmittingState"
          :refreshing="loadingState === 'refresh'"
          @change-draft="editorDraft = $event"
          @save-page="savePage"
          @apply-patch="applyPatch"
          @remove-section="removeSection"
          @clear-sections="clearSections"
          @refresh="refreshData"
          @save-page-settings="savePageSettings"
        />
      </main>

      <aside class="preview-column">
        <SectionPreviewCanvas :page="persistedPage" :active-section-id="activeEventSectionId" />
        <SectionEventTimeline :events="visibleSectionEvents" :connected="eventConnected" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getBoardTypeSections,
  getDebugSectionState,
  patchDebugSection,
  sendDebugSection
} from '@/api/sdui';
import {
  buildSingleSectionPatch,
  cloneSectionPage,
  createDraftKey,
  normalizeSectionEditor,
  normalizeSectionState
} from '../normalize';
import type { DebugEventStreamItem, DebugSectionEditor, DebugSectionPage, DebugSectionState } from '../types';
import SectionEventTimeline from './SectionEventTimeline.vue';
import SectionPreviewCanvas from './SectionPreviewCanvas.vue';
import SectionWorkspaceEditor from './SectionWorkspaceEditor.vue';

const props = defineProps<{
  deviceId: string;
  board: string;
  events: DebugEventStreamItem[];
  eventConnected: boolean;
}>();

const editorMeta = ref<DebugSectionEditor>({
  deviceId: '',
  online: false,
  renderMode: 'rich',
  sizeClass: '',
  layouts: [],
  sectionTypes: []
});
const sectionState = ref<DebugSectionState>({
  deviceId: '',
  page: null
});
const editorDraft = ref<DebugSectionPage>({
  pageId: '',
  layout: 'vertical_scroll',
  autoScroll: false,
  autoScrollMs: 0,
  sections: []
});
const loadingState = ref<'' | 'refresh'>('');
const editorSubmittingState = ref<'' | 'save' | 'patch' | 'remove'>('');

const persistedPage = computed(() => sectionState.value.page);
const visibleSectionEvents = computed(() => {
  const page = persistedPage.value;
  return props.events.filter((event) => {
    if (event.category === 'physical_input') return true;
    if (!event.section && event.inputSource?.type !== 'section') return false;
    if (!event.section || !page) return false;
    return event.section.pageId === page.pageId &&
      page.sections.some((section) => section.sectionId === event.section?.sectionId);
  }).slice(0, 50);
});
const activeEventSectionId = ref('');
let eventHighlightTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => {
    const event = visibleSectionEvents.value.find((item) => item.section);
    return [event?.section?.sectionId || '', event?.ts || ''] as const;
  },
  ([sectionId]) => {
    if (eventHighlightTimer) clearTimeout(eventHighlightTimer);
    activeEventSectionId.value = sectionId;
    if (!activeEventSectionId.value) return;
    eventHighlightTimer = setTimeout(() => {
      activeEventSectionId.value = '';
    }, 2200);
  }
);

async function refreshData() {
  if (!props.deviceId) return;
  loadingState.value = 'refresh';
  try {
    const [editorResponse, stateResponse] = await Promise.all([
      getBoardTypeSections(props.board),
      getDebugSectionState(props.deviceId)
    ]);
    editorMeta.value = normalizeSectionEditor(editorResponse);
    sectionState.value = normalizeSectionState(stateResponse);
    syncDraftFromWorkspace();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载 Section 调试数据失败'));
  } finally {
    loadingState.value = '';
  }
}

function syncDraftFromWorkspace() {
  editorDraft.value = cloneSectionPage(persistedPage.value);
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
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '整页保存失败'));
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function savePageSettings(settings: Pick<DebugSectionPage, 'layout' | 'autoScroll' | 'autoScrollMs'>) {
  const currentPage = persistedPage.value;
  if (!currentPage?.sections.length) {
    ElMessage.warning('请先添加并保存至少一个 Section');
    return;
  }

  editorSubmittingState.value = 'save';
  try {
    await sendDebugSection(props.deviceId, {
      ...settings,
      sections: currentPage.sections.map((item) => ({
        ...(item.sectionId ? { sectionId: item.sectionId } : {}),
        sectionType: item.sectionType,
        fields: item.fields
      }))
    });
    sectionState.value = {
      ...sectionState.value,
      page: { ...currentPage, ...settings }
    };
    ElMessage.success('页面设置已保存');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '页面设置保存失败'));
  } finally {
    editorSubmittingState.value = '';
  }
}

async function applyPatch(sectionRef: string, op: 'add' | 'update') {
  const section = editorDraft.value.sections.find((item) => (item.draftKey || item.sectionId) === sectionRef);
  if (!section) return;
  if (!persistedPage.value) {
    ElMessage.warning('请先整页保存，再进行增量更新');
    return;
  }
  editorSubmittingState.value = 'patch';
  try {
    const patchPayload = buildSingleSectionPatch(section, op);
    await patchDebugSection(props.deviceId, {
      patches: [patchPayload]
    });
    ElMessage.success(op === 'add' ? 'Section 已添加到当前页面' : 'Patch 已应用');
    await refreshData();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, 'Patch 失败'));
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function removeSection(sectionRef: string) {
  const section = editorDraft.value.sections.find((item) => (item.draftKey || item.sectionId) === sectionRef);
  if (!section) return;
  const persisted = !!section.sectionId && !!persistedPage.value?.sections.some((item) => item.sectionId === section.sectionId);
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
      patches: [buildSingleSectionPatch(section, 'remove')]
    });
    ElMessage.success('Section 已删除');
    await refreshData();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '删除 section 失败'));
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function clearSections() {
  if (!editorDraft.value.sections.length) return;
  try {
    await ElMessageBox.confirm('确认清除“已添加内容”中的全部 Section？', '清除确认', {
      type: 'warning'
    });
  } catch {
    return;
  }

  const persistedSections = editorDraft.value.sections.filter(
    (section) => !!section.sectionId && !!persistedPage.value?.sections.some((item) => item.sectionId === section.sectionId)
  );
  if (!persistedSections.length) {
    editorDraft.value = {
      ...editorDraft.value,
      sections: []
    };
    return;
  }

  editorSubmittingState.value = 'remove';
  try {
    await patchDebugSection(props.deviceId, {
      patches: persistedSections.map((section) => buildSingleSectionPatch(section, 'remove'))
    });
    ElMessage.success('全部 Section 已清除');
    await refreshData();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '清除全部 Section 失败'));
    await refreshStateOnly();
  } finally {
    editorSubmittingState.value = '';
  }
}

async function refreshStateOnly() {
  try {
    const stateResponse = await getDebugSectionState(props.deviceId);
    sectionState.value = normalizeSectionState(stateResponse);
    syncDraftFromWorkspace();
    editorDraft.value.sections = editorDraft.value.sections.map((item) => ({
      ...item,
      draftKey: item.draftKey || createDraftKey(item.sectionId || 'section')
    }));
  } catch {
    // keep previous error message
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

defineExpose({
  refreshData
});

onBeforeUnmount(() => {
  if (eventHighlightTimer) clearTimeout(eventHighlightTimer);
});
</script>

<style scoped>
.section-panel {
  display: flex;
  flex-direction: column;
}

.section-grid {
  display: grid;
  grid-template-columns: minmax(620px, 1.55fr) minmax(360px, 0.8fr);
  align-items: start;
  gap: 14px;
}

.editor-column,
.preview-column {
  min-width: 0;
}

.preview-column {
  position: sticky;
  top: 12px;
}

@media (max-width: 1280px) {
  .section-grid {
    grid-template-columns: 1fr;
  }

  .preview-column {
    position: static;
  }
}

</style>
