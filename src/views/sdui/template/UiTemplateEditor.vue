<template>
  <div class="template-editor app-container">
    <header class="page-header">
      <div class="page-title-group">
        <el-button text class="back-button" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回模板列表
        </el-button>
        <div>
          <span class="page-kicker">UI Template</span>
          <h1>{{ isEdit ? '编辑 UI 模板' : '新建 UI 模板' }}</h1>
          <p>使用与 Section 调试一致的页面结构维护模板、变量与实时预览。</p>
        </div>
      </div>
      <div class="header-actions">
        <el-button @click="showPreview">查看数据</el-button>
        <el-button type="primary" :loading="saving" @click="saveTemplate">保存模板</el-button>
      </div>
    </header>

    <section class="template-status">
      <el-form ref="formRef" :model="form" :rules="rules" class="template-meta-form">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：设备主视图" />
        </el-form-item>
        <el-form-item label="板卡类型" prop="board">
          <el-select
            v-model="form.board"
            filterable
            placeholder="选择板卡类型"
            @change="handleBoardTypeChange"
          >
            <el-option
              v-for="boardType in boardTypes"
              :key="boardType.board"
              :label="boardType.label || boardType.board"
              :value="boardType.board"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="status-meta">
        <div class="meta-item">
          <span>模板 Key</span>
          <strong>{{ savedTemplateKey || '保存后生成' }}</strong>
        </div>
        <div class="meta-item">
          <span>Sections</span>
          <strong>{{ form.sections.length }}</strong>
        </div>
        <div class="meta-item">
          <span>变量</span>
          <strong>{{ form.variables.length }}</strong>
        </div>
      </div>
    </section>

    <div v-if="form.board" class="workspace-grid">
      <main class="workspace-card">
        <div class="workspace-header">
          <div>
            <h2>模板编辑器</h2>
            <p>左侧选择 Section，右侧维护字段；保存后写入模板 Definition。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveTemplate">保存模板</el-button>
        </div>

        <div class="page-config">
          <label class="config-field">
            <span>页面布局</span>
            <el-select v-model="form.layout" size="small">
              <el-option v-for="layout in boardLayouts" :key="layout" :label="layoutLabel(layout)" :value="layout" />
            </el-select>
          </label>
          <div class="config-summary">
            <span>能力来源</span>
            <strong>{{ currentBoardLabel }}</strong>
          </div>
        </div>

        <div class="section-editor-grid">
          <SectionCatalog :types="boardSectionTypes" @add="addSection" />

          <aside class="section-sidebar">
            <div class="sidebar-heading">
              <div class="sidebar-title">
                <span>已添加内容</span>
                <el-tag size="small" type="info">{{ form.sections.length }}</el-tag>
              </div>
              <div class="sidebar-actions">
                <el-tooltip content="全部保存" placement="top">
                  <el-button
                    class="icon-action"
                    type="primary"
                    text
                    :icon="DocumentChecked"
                    :loading="saving"
                    :disabled="!form.sections.length || saving"
                    aria-label="全部保存"
                    @click="saveTemplate"
                  />
                </el-tooltip>
                <el-tooltip content="全部清理" placement="top">
                  <el-button
                    class="icon-action danger"
                    text
                    :icon="Delete"
                    :disabled="!form.sections.length || saving"
                    aria-label="全部清理"
                    @click="clearSections"
                  />
                </el-tooltip>
              </div>
            </div>
            <div class="section-list">
              <div
                v-for="(section, index) in form.sections"
                :key="section.sectionId || `${section.sectionType}-${index}`"
                class="section-pill"
                :class="[`is-${sectionStatus(section, index)}`, { active: index === selectedSectionIndex }]"
              >
                <button type="button" class="section-pill-main" @click="selectedSectionIndex = index">
                  <span class="section-index">{{ index + 1 }}</span>
                  <span class="section-pill-copy">
                    <strong>{{ getSchemaDisplayName(section.sectionType) }}</strong>
                    <small>{{ section.sectionId || '未设置 Section ID' }}</small>
                  </span>
                </button>
                <span class="section-status" :class="`is-${sectionStatus(section, index)}`">
                  {{ sectionStatusLabel(section, index) }}
                </span>
                <span class="section-item-actions">
                  <el-tooltip content="提交当前卡片" placement="top">
                    <el-button
                      class="item-icon-action"
                      type="primary"
                      text
                      :icon="Check"
                      :loading="saving && index === selectedSectionIndex"
                      :disabled="saving"
                      aria-label="提交当前卡片"
                      @click="saveSection(index)"
                    />
                  </el-tooltip>
                  <el-tooltip content="删除当前卡片" placement="top">
                    <el-button
                      class="item-icon-action danger"
                      text
                      :icon="Delete"
                      :disabled="saving"
                      aria-label="删除当前卡片"
                      @click="removeSection(index)"
                    />
                  </el-tooltip>
                </span>
              </div>
              <el-empty
                v-if="!form.sections.length"
                description="暂无内容"
                :image-size="42"
              />
            </div>
          </aside>

          <section v-if="currentSection" class="field-editor">
            <div class="field-editor-head">
              <div>
                <h3>{{ getSchemaDisplayName(currentSection.sectionType) }}</h3>
                <p>{{ currentSchema?.type || currentSection.sectionType }}</p>
              </div>
              <el-tag size="small">{{ currentSchema?.displayFields.length || 0 }} 个字段</el-tag>
            </div>

            <label class="section-id-field">
              <span>Section ID</span>
              <el-input
                :model-value="currentSection.sectionId"
                placeholder="例如：hero_main"
                @change="updateSectionId(String($event || ''))"
              />
            </label>

            <el-form label-position="top" size="small" class="fields-form">
              <el-form-item
                v-for="field in currentFields"
                :key="`${currentSection.sectionType}-${field.name}`"
                :label="fieldLabel(field)"
                :required="field.required"
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

                <div class="variable-toggle">
                  <el-checkbox
                    :model-value="hasVariable(currentSection.sectionId, field.name)"
                    @change="toggleVariable(currentSection.sectionId, field.name, field.type, Boolean($event))"
                  >
                    暴露为模板变量
                  </el-checkbox>
                </div>
              </el-form-item>
            </el-form>
          </section>

          <div v-else class="editor-empty">
            <div class="empty-illustration"><span>＋</span></div>
            <strong>从组件库添加内容</strong>
            <p>点击左侧任意样例卡片，即可在这里设置参数。</p>
          </div>
        </div>
      </main>

      <aside class="right-column">
        <SectionPreviewCanvas :page="previewPage" />

        <section class="variables-card">
          <div class="variables-header">
            <div>
              <h2>模板变量</h2>
              <p>变量绑定到 Section 字段，工作流运行时可动态覆盖。</p>
            </div>
            <el-tag size="small" type="info">{{ form.variables.length }}</el-tag>
          </div>

          <div class="variable-list">
            <article v-for="(variable, index) in form.variables" :key="`${variable.sectionId}-${variable.field}`" class="variable-card">
              <div class="variable-card-head">
                <el-input v-model="variable.variableKey" size="small" placeholder="变量 Key" />
                <el-button type="danger" text @click="removeVariable(index)">删除</el-button>
              </div>
              <div class="variable-path">{{ variable.sectionId }}.{{ variable.field }}</div>
              <div class="variable-default">
                <span>默认值</span>
                <el-switch
                  v-if="variable.type === 'bool'"
                  v-model="variable.defaultValue"
                  size="small"
                />
                <el-input-number
                  v-else-if="variable.type === 'int' || variable.type === 'float'"
                  v-model="variable.defaultValue"
                  size="small"
                  controls-position="right"
                />
                <SchemaFieldInput
                  v-else-if="getVariableField(variable)"
                  :field="getVariableField(variable)!"
                  :model-value="variable.defaultValue"
                  @update:model-value="variable.defaultValue = $event"
                />
                <el-input
                  v-else
                  :model-value="stringifyVariableValue(variable.defaultValue)"
                  size="small"
                  @input="variable.defaultValue = $event"
                />
              </div>
            </article>
            <el-empty
              v-if="!form.variables.length"
              description="在字段下方勾选“暴露为模板变量”"
              :image-size="40"
            />
          </div>
        </section>
      </aside>
    </div>

    <section v-else class="empty-state">
      <el-empty description="请先选择板卡类型，以加载可用的 Section 能力" :image-size="64" />
    </section>

    <el-dialog v-model="previewVisible" title="模板 Definition" width="680px">
      <pre class="preview-json">{{ JSON.stringify(previewResult, null, 2) }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Check, Delete, DocumentChecked } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  createTemplate,
  getSectionTypeSchemas,
  getTemplate,
  previewTemplate,
  updateTemplate
} from '@/api/ui-template';
import { getBoardTypes, getBoardTypeSections } from '@/api/sdui';
import SectionPreviewCanvas from '@/views/sdui/debug/components/SectionPreviewCanvas.vue';
import SectionCatalog from '@/views/sdui/debug/components/SectionCatalog.vue';
import SchemaFieldInput from '@/views/sdui/debug/components/SchemaFieldInput.vue';
import { normalizeSectionEditor } from '@/views/sdui/debug/normalize';
import { getFieldSemantic, getSectionSemantic } from '@/views/sdui/debug/sectionSemantics';
import { buildSectionFields } from '@/views/sdui/debug/sectionSamples';
import type { DebugSectionDisplayField, DebugSectionPage, DebugSectionType } from '@/views/sdui/debug/types';

interface SectionForm {
  sectionId: string;
  sectionType: string;
  fields: Record<string, unknown>;
}

interface BoardTypeOption {
  board: string;
  label: string;
  sectionTypes: string[];
}

interface TemplateFieldSchema {
  name: string;
  type: string;
  required: boolean;
  description: string | null;
  label?: string;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  children?: TemplateFieldSchema[];
}

interface TemplateSectionSchema {
  type: string;
  displayName: string;
  fields: TemplateFieldSchema[];
  operations?: string[];
  events?: Array<{ eventId: string }>;
}

interface TemplateVariable {
  variableKey: string;
  sectionId: string;
  field: string;
  type: string;
  defaultValue: unknown;
}

interface TemplatePayload {
  name: string;
  board: string;
  layout: string;
  sections: SectionForm[];
  variables: TemplateVariable[];
  mockData: Record<string, unknown>;
}

const router = useRouter();
const route = useRoute();
const formRef = ref<FormInstance>();
const saving = ref(false);
const previewVisible = ref(false);
const previewResult = ref<Record<string, unknown>>({});
const templateId = ref<string | null>(null);
const savedTemplateKey = ref('');
const selectedSectionIndex = ref(-1);
const boardTypes = ref<BoardTypeOption[]>([]);
const globalSchemas = ref<TemplateSectionSchema[]>([]);
const boardSectionTypes = ref<DebugSectionType[]>([]);
const boardLayouts = ref<string[]>([]);
const savedSectionSnapshots = ref<string[]>([]);

const form = reactive({
  name: '',
  board: '',
  layout: 'vertical_scroll',
  sections: [] as SectionForm[],
  variables: [] as TemplateVariable[]
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  board: [{ required: true, message: '请选择板卡类型', trigger: 'change' }]
};

const isEdit = computed(() => Boolean(templateId.value));
const globalSchemaMap = computed(() => new Map(globalSchemas.value.map((schema) => [schema.type, schema])));
const boardSchemaMap = computed(() => new Map(boardSectionTypes.value.map((schema) => [schema.type, schema])));
const currentSection = computed(() => form.sections[selectedSectionIndex.value] || null);
const currentSchema = computed(() => currentSection.value ? boardSchemaMap.value.get(currentSection.value.sectionType) || null : null);
const currentFields = computed(() => currentSchema.value?.displayFields || []);
const currentBoardLabel = computed(() => {
  return boardTypes.value.find((item) => item.board === form.board)?.label || form.board;
});
const previewPage = computed<DebugSectionPage>(() => ({
  pageId: savedTemplateKey.value || 'template_preview',
  layout: form.layout,
  autoScroll: false,
  autoScrollMs: 0,
  sections: form.sections.map((section) => ({ ...section }))
}));

watch(
  () => form.sections.length,
  (length) => {
    if (!length) {
      selectedSectionIndex.value = -1;
    } else if (selectedSectionIndex.value < 0 || selectedSectionIndex.value >= length) {
      selectedSectionIndex.value = 0;
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await Promise.all([loadBoardTypes(), loadGlobalSchemas()]);
  const id = String(route.query.id || '');
  if (id) {
    templateId.value = id;
    await loadTemplate(id);
  }
});

async function loadBoardTypes() {
  try {
    const response = await getBoardTypes();
    const items = Array.isArray(response?.data) ? response.data : [];
    boardTypes.value = items.map((item: Record<string, unknown>) => ({
      board: String(item.board || ''),
      label: String(item.label || item.board || ''),
      sectionTypes: Array.isArray(item.sectionTypes)
        ? item.sectionTypes.map((type) => String(type))
        : []
    })).filter((item: BoardTypeOption) => item.board);
  } catch {
    boardTypes.value = [];
  }
}

async function loadGlobalSchemas() {
  try {
    const response = await getSectionTypeSchemas();
    const payload = unwrapApi(response);
    globalSchemas.value = Array.isArray(payload) ? payload as TemplateSectionSchema[] : [];
  } catch {
    globalSchemas.value = [];
  }
}

async function loadBoardSectionTypes(board: string) {
  boardSectionTypes.value = [];
  boardLayouts.value = [];
  if (!board) return;
  try {
    const response = await getBoardTypeSections(board);
    const editor = normalizeSectionEditor(response);
    boardSectionTypes.value = editor.sectionTypes;
    boardLayouts.value = editor.layouts;
    if (!boardLayouts.value.includes(form.layout)) {
      form.layout = boardLayouts.value[0] || 'vertical_scroll';
    }
  } catch {
    boardSectionTypes.value = globalSchemas.value.map((schema) => ({
      type: schema.type,
      displayFields: schema.fields.map((field) => normalizeGlobalField(field)),
      events: schema.events?.map((event) => event.eventId) || [],
      patchOps: schema.operations || []
    }));
    boardLayouts.value = ['vertical_scroll', 'horizontal_pages', 'fixed_single', 'overlay'];
  }
}

async function handleBoardTypeChange(board: string) {
  form.sections = [];
  form.variables = [];
  savedSectionSnapshots.value = [];
  selectedSectionIndex.value = -1;
  await loadBoardSectionTypes(board);
}

async function loadTemplate(id: string) {
  try {
    const response = await getTemplate(id);
    const template = asRecord(unwrapApi(response));
    const definition = asRecord(template.definition);
    const sections = Array.isArray(definition.sections)
      ? definition.sections.map((section) => {
        const record = asRecord(section);
        return {
          sectionId: String(record.sectionId || ''),
          sectionType: String(record.sectionType || ''),
          fields: asRecord(record.fields)
        };
      })
      : [];
    form.name = String(template.name || '');
    savedTemplateKey.value = String(template.templateKey || '');
    form.layout = String(definition.layout || 'vertical_scroll');
    form.sections = sections;
    form.board = String(definition.board || template.board || '') || inferTemplateBoard(definition, sections);
    syncSectionSnapshots();
    form.variables = Array.isArray(definition.variables)
      ? definition.variables.map((variable: TemplateVariable) => ({ ...variable }))
      : [];
    selectedSectionIndex.value = form.sections.length ? 0 : -1;
    await loadBoardSectionTypes(form.board);
  } catch {
    ElMessage.error('加载模板失败');
  }
}

function inferTemplateBoard(definition: Record<string, unknown>, sections: SectionForm[]) {
  const declaredTypes = Array.isArray(definition.requiredSectionTypes)
    ? definition.requiredSectionTypes.map((type) => String(type))
    : [];
  const requiredTypes = new Set(
    (declaredTypes.length ? declaredTypes : sections.map((section) => section.sectionType)).filter(Boolean)
  );
  const compatibleBoards = boardTypes.value.filter((item) =>
    Array.from(requiredTypes).every((type) => item.sectionTypes.includes(type))
  );
  return compatibleBoards
    .sort((left, right) => left.sectionTypes.length - right.sectionTypes.length)[0]?.board ||
    boardTypes.value[0]?.board ||
    '';
}

function addSection(schema: DebugSectionType) {
  const sectionType = schema.type;
  form.sections.push({
    sectionId: `sec_${form.sections.length + 1}_${sectionType}`,
    sectionType,
    fields: buildSectionFields(schema)
  });
  selectedSectionIndex.value = form.sections.length - 1;
}

function removeSection(index: number) {
  const section = form.sections[index];
  if (!section) return;
  const sectionId = section.sectionId;
  form.sections.splice(index, 1);
  savedSectionSnapshots.value.splice(index, 1);
  form.variables = form.variables.filter((variable) => variable.sectionId !== sectionId);
  if (selectedSectionIndex.value > index) selectedSectionIndex.value -= 1;
}

async function clearSections() {
  try {
    await ElMessageBox.confirm('确认清理全部 Section？对应的模板变量也会一并删除。', '清理确认', {
      type: 'warning'
    });
  } catch {
    return;
  }
  form.sections = [];
  form.variables = [];
  savedSectionSnapshots.value = [];
  selectedSectionIndex.value = -1;
}

async function saveSection(index: number) {
  selectedSectionIndex.value = index;
  await saveTemplate();
}

function updateSectionId(nextId: string) {
  if (!currentSection.value) return;
  const previousId = currentSection.value.sectionId;
  currentSection.value.sectionId = nextId;
  for (const variable of form.variables) {
    if (variable.sectionId === previousId) variable.sectionId = nextId;
  }
}

function setCurrentField(fieldName: string, value: unknown) {
  if (!currentSection.value) return;
  currentSection.value.fields[fieldName] = value;
  const variable = form.variables.find(
    (item) => item.sectionId === currentSection.value?.sectionId && item.field === fieldName
  );
  if (variable) variable.defaultValue = value;
}

function hasVariable(sectionId: string, fieldName: string) {
  return form.variables.some((variable) => variable.sectionId === sectionId && variable.field === fieldName);
}

function toggleVariable(sectionId: string, fieldName: string, fieldType: string, checked: boolean) {
  if (!sectionId) {
    ElMessage.warning('请先填写 Section ID');
    return;
  }
  if (!checked) {
    form.variables = form.variables.filter(
      (variable) => !(variable.sectionId === sectionId && variable.field === fieldName)
    );
    return;
  }
  if (hasVariable(sectionId, fieldName)) return;
  const section = form.sections.find((item) => item.sectionId === sectionId);
  form.variables.push({
    variableKey: createVariableKey(sectionId, fieldName),
    sectionId,
    field: fieldName,
    type: fieldType === 'enum' ? 'string' : fieldType,
    defaultValue: section?.fields[fieldName] ?? ''
  });
}

function removeVariable(index: number) {
  form.variables.splice(index, 1);
}

function getVariableField(variable: TemplateVariable) {
  const section = form.sections.find((item) => item.sectionId === variable.sectionId);
  if (!section) return null;
  return boardSchemaMap.value.get(section.sectionType)?.displayFields.find((field) => field.name === variable.field) || null;
}

function createVariableKey(sectionId: string, fieldName: string) {
  const base = `${sectionId}_${fieldName}`;
  if (!form.variables.some((variable) => variable.variableKey === base)) return base;
  return `${base}_${form.variables.length + 1}`;
}

function normalizeGlobalField(field: TemplateFieldSchema): DebugSectionDisplayField {
  return {
    name: field.name,
    type: field.type,
    label: field.label || field.name,
    default: field.default,
    required: field.required,
    options: field.options || [],
    min: field.min,
    max: field.max,
    children: (field.children || []).map((child) => normalizeGlobalField(child))
  };
}

function getSchemaDisplayName(sectionType: string) {
  return getSectionSemantic(sectionType).title || globalSchemaMap.value.get(sectionType)?.displayName || sectionType;
}

function layoutLabel(layout: string) {
  return ({
    vertical_scroll: '纵向滚动',
    horizontal_pages: '横向分页',
    fixed_single: '固定单页',
    overlay: '浮层布局'
  } as Record<string, string>)[layout] || layout;
}

function fieldLabel(field: DebugSectionDisplayField) {
  return field.label || getFieldSemantic(currentSection.value?.sectionType || '', field).label;
}

function stringifyVariableValue(value: unknown) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function buildPayload(): TemplatePayload {
  const mockData = Object.fromEntries(
    form.variables.map((variable) => [variable.variableKey, variable.defaultValue])
  );
  return {
    name: form.name,
    board: form.board,
    layout: form.layout,
    sections: form.sections,
    variables: form.variables,
    mockData
  };
}

async function saveTemplate() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  if (!form.sections.length) {
    ElMessage.warning('至少需要一个 Section');
    return;
  }
  if (new Set(form.sections.map((section) => section.sectionId)).size !== form.sections.length) {
    ElMessage.warning('Section ID 不能重复');
    return;
  }

  saving.value = true;
  try {
    if (templateId.value) {
      await updateTemplate(templateId.value, buildPayload());
    } else {
      const response = await createTemplate(buildPayload());
      const template = asRecord(unwrapApi(response));
      templateId.value = String(template.id || '');
      savedTemplateKey.value = String(template.templateKey || '');
      if (templateId.value) {
        await router.replace({ query: { id: templateId.value }});
      }
    }
    syncSectionSnapshots();
    ElMessage.success('模板已保存');
  } catch {
    ElMessage.error('保存模板失败');
  } finally {
    saving.value = false;
  }
}

function sectionStatus(section: SectionForm, index: number) {
  const snapshot = savedSectionSnapshots.value[index];
  if (!snapshot) return 'local';
  return snapshot === stableSerialize(section) ? 'saved' : 'pending';
}

function sectionStatusLabel(section: SectionForm, index: number) {
  const status = sectionStatus(section, index);
  if (status === 'saved') return '已保存';
  if (status === 'pending') return '未提交';
  return '未保存';
}

function syncSectionSnapshots() {
  savedSectionSnapshots.value = form.sections.map((section) => stableSerialize(section));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

async function showPreview() {
  previewVisible.value = true;
  previewResult.value = buildPayload() as unknown as Record<string, unknown>;
  if (!templateId.value) return;
  try {
    const response = await previewTemplate(templateId.value);
    previewResult.value = asRecord(unwrapApi(response));
  } catch {
    ElMessage.error('加载模板预览数据失败');
  }
}

function goBack() {
  router.push({ name: 'SduiUiTemplates' });
}

function unwrapApi(value: unknown): unknown {
  const record = asRecord(value);
  return 'data' in record ? record.data : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
</script>

<style scoped>
.template-editor {
  min-height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #f5f7fb;
}

.page-header,
.header-actions,
.template-status,
.status-meta,
.workspace-header,
.editor-toolbar,
.toolbar-group,
.field-editor-head,
.variables-header,
.variable-card-head,
.variable-default {
  display: flex;
  align-items: center;
}

.page-header,
.template-status,
.workspace-header,
.editor-toolbar,
.field-editor-head,
.variables-header,
.variable-card-head {
  justify-content: space-between;
}

.page-header {
  gap: 24px;
  padding: 4px 2px;
}

.page-title-group {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.back-button {
  margin-top: 18px;
}

.page-kicker {
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 4px 0;
  color: #0f172a;
  font-size: 26px;
}

.page-header p,
.workspace-header p,
.field-editor-head p,
.variables-header p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.header-actions,
.toolbar-group {
  gap: 8px;
}

.template-status {
  gap: 24px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f8fafc;
}

.template-meta-form {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr);
  gap: 16px;
}

.template-meta-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.template-meta-form :deep(.el-form-item__label) {
  color: #64748b;
  font-size: 12px;
}

.template-meta-form :deep(.el-select) {
  width: 100%;
}

.status-meta {
  gap: 22px;
}

.meta-item,
.config-summary {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 82px;
}

.meta-item span,
.config-summary span {
  color: #94a3b8;
  font-size: 11px;
}

.meta-item strong,
.config-summary strong {
  max-width: 170px;
  overflow: hidden;
  color: #334155;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(640px, 1.55fr) minmax(360px, 0.8fr);
  align-items: start;
  gap: 14px;
}

.workspace-card,
.variables-card,
.empty-state {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}

.workspace-card {
  min-width: 0;
  padding: 16px 18px 18px;
  container-type: inline-size;
  container-name: workspace;
}

.workspace-header h2,
.variables-header h2 {
  margin: 0 0 3px;
  color: #0f172a;
  font-size: 16px;
}

.page-config {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(150px, 1fr);
  align-items: end;
  gap: 16px;
  padding: 12px 0;
  margin-top: 12px;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-field > span {
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}

.editor-toolbar {
  min-height: 32px;
  padding: 14px 0;
  gap: 12px;
}

.toolbar-intro {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.toolbar-intro strong {
  color: #263249;
  font-size: 13px;
}

.toolbar-intro span {
  color: #8390a4;
  font-size: 11px;
}

.section-editor-grid {
  display: grid;
  grid-template-columns: 220px 280px minmax(360px, 1fr);
  align-items: start;
  gap: 12px;
}

.section-sidebar,
.field-editor,
.editor-empty {
  min-height: 470px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.section-sidebar {
  overflow: hidden;
  background: #f8fafc;
}

.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
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

.icon-action,
.item-icon-action {
  margin: 0 !important;
  padding: 0;
  border-radius: 7px;
}

.icon-action {
  width: 26px;
  height: 26px;
}

.icon-action.danger,
.item-icon-action.danger {
  color: #ef4444;
}

.section-list {
  max-height: 560px;
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-pill {
  width: 100%;
  min-height: 52px;
  padding: 5px 6px 5px 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
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

.section-item-actions {
  flex: 0 0 auto;
  gap: 0;
  opacity: .65;
  transition: opacity .15s ease;
}

.section-pill:hover .section-item-actions,
.section-pill.active .section-item-actions {
  opacity: 1;
}

.item-icon-action {
  width: 24px;
  height: 24px;
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

.field-editor {
  padding: 20px 22px;
}

.editor-empty {
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-style: dashed;
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

.field-editor-head h3 {
  margin: 0 0 3px;
  color: #0f172a;
  font-size: 15px;
}

.section-id-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
}

.section-id-field > span {
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.fields-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fields-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.fields-form :deep(.el-form-item__content) {
  display: block;
}

.field-help {
  margin: -3px 0 7px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.full-control {
  width: 100%;
}

.color-control {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
}

.variable-toggle {
  margin-top: 7px;
}

.right-column {
  min-width: 0;
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.variables-card {
  padding: 16px;
}

.variable-list {
  max-height: 370px;
  margin-top: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variable-card {
  padding: 11px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}

.variable-card-head {
  gap: 8px;
}

.variable-path {
  margin: 5px 0 9px;
  color: #64748b;
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.variable-default {
  gap: 8px;
}

.variable-default > span {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 12px;
}

.variable-default :deep(.el-input),
.variable-default :deep(.el-input-number) {
  width: 100%;
}

.empty-state {
  padding: 56px 20px;
}

.preview-json {
  max-height: 520px;
  margin: 0;
  overflow: auto;
  padding: 16px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  white-space: pre-wrap;
}

@media (max-width: 1280px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .right-column {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .template-status,
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .section-editor-grid,
  .right-column {
    grid-template-columns: 1fr;
  }

  .section-sidebar {
    min-height: auto;
  }

  .section-list {
    max-height: 230px;
  }
}

@container workspace (max-width: 840px) {
  .section-editor-grid {
    grid-template-columns: 280px minmax(320px, 1fr);
  }

  .section-editor-grid :deep(.catalog) {
    grid-column: 1 / -1;
  }

  .section-sidebar,
  .field-editor,
  .editor-empty {
    min-height: 360px;
  }
}

@container workspace (max-width: 680px) {
  .section-editor-grid {
    grid-template-columns: 1fr;
  }

  .section-editor-grid :deep(.catalog) {
    justify-self: center;
  }
}

@media (max-width: 640px) {
  .template-editor {
    padding: 12px;
  }

  .page-title-group {
    flex-direction: column;
    gap: 4px;
  }

  .back-button {
    margin-top: 0;
  }

  .header-actions,
  .toolbar-group {
    align-items: stretch;
  }

  .template-meta-form,
  .page-config {
    grid-template-columns: 1fr;
  }

  .status-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .editor-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

}
</style>
