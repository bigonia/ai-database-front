<template>
  <div class="workflow-editor">
    <!-- 工具栏 -->
    <ToolbarActions
      :workflow-name="workflow.name || '未命名'"
      :is-dirty="isDirty"
      :saving="saving"
      :validating="validating"
      :deploying="deployLoading"
      :back-route="true"
      @back="goBack"
      @save="saveWorkflow"
      @validate="validateWorkflowDef"
      @deploy="requestDeploy"
    />

    <WorkflowStatusBar
      v-model:name="workflow.name"
      :slots="workflow.slots"
      :nodes="workflow.nodes"
      :edges="workflow.edges"
      :ui-templates="workflow.uiTemplates"
      :saved="Boolean(workflow.id) && !isDirty"
    />

    <div class="editor-body">
      <!-- 左侧面板 -->
      <aside class="editor-sidebar">
        <SlotPanel
          :slots="workflow.slots"
          :selected-slot-id="selectedSlotId"
          @add-slot="openSlotDialog()"
          @edit-slot="openSlotDialog($event)"
          @remove-slot="removeSlot"
          @select-slot="selectedSlotId = $event"
        />
        <NodePalette
          :selected-slot-id="selectedSlotId"
          :slots="workflow.slots"
          @loaded="onCapabilityNodesLoaded"
          @add-node="addNodeFromPalette"
        />
        <UiTemplatePanel
          :slots="workflow.slots"
          :bindings="workflow.uiTemplates"
          :templates="uiTemplateDetails"
          @update:bindings="workflow.uiTemplates = $event"
        />
      </aside>

      <!-- 中央画布 -->
      <WorkflowCanvas
        :nodes="graph.vueFlowNodes.value"
        :edges="graph.vueFlowEdges.value"
        @update:nodes="onNodesUpdated"
        @update:edges="onEdgesUpdated"
        @connect="onConnect"
        @node-click="onNodeClick"
        @drop="onDrop"
      />

      <div v-if="!workflow.nodes.length" class="canvas-guide">
        <strong>开始编排工作流</strong>
        <p>从左侧能力目录拖入一个触发节点和至少一个输出节点，再连接它们。</p>
      </div>
    </div>

    <!-- 节点配置抽屉 -->
    <NodeConfigDrawer
      :node="selectedNode"
      :capability-def="selectedCapDef"
      :ui-templates="uiTemplateDetails"
      :ui-bindings="workflow.uiTemplates"
      :board-events="selectedNodeBoardEvents"
      @close="selectedNodeId = null"
      @remove="removeNode"
      @update-params="updateNodeParams"
    />

    <!-- 槽位配置弹窗 -->
    <SlotConfigDialog
      :visible="slotDialogVisible"
      :is-edit="!!editingSlotId"
      :board-types="boardTypes"
      :initial-data="editingSlot"
      @close="slotDialogVisible = false"
      @confirm="onSlotConfirm"
    />

    <!-- 部署弹窗 -->
    <DeploymentDialog
      :visible="showDeployDialog"
      :slots="workflow.slots"
      :devices="deviceOptions"
      @close="showDeployDialog = false"
      @deploy="onDeploy"
    />

    <!-- 校验结果面板 -->
    <ValidationPanel
      :visible="validationVisible"
      :loading="validating"
      :errors="validationErrors"
      :warnings="validationWarnings"
      @close="validationVisible = false"
    />

    <WorkflowInitDialog
      :visible="initDialogVisible"
      :board-types="boardTypes"
      @cancel="goBack"
      @confirm="initializeWorkflow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { Connection } from '@vue-flow/core';

import {
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  validateWorkflow,
  deployWorkflow
} from '@/api/node-workflow';
import { getBoardTypes, getBoardTypeEvents } from '@/api/sdui';
import { getDeviceList } from '@/api/sdui';
import { getCapabilityNodesForBoardType } from '@/api/capability-node';
import { getTemplate, listTemplates } from '@/api/ui-template';
import { useWorkflowGraph } from './composables/useWorkflowGraph';

import ToolbarActions from './components/ToolbarActions.vue';
import SlotPanel from './components/SlotPanel.vue';
import NodePalette from './components/NodePalette.vue';
import WorkflowCanvas from './components/WorkflowCanvas.vue';
import NodeConfigDrawer from './components/NodeConfigDrawer.vue';
import SlotConfigDialog from './components/SlotConfigDialog.vue';
import DeploymentDialog from './components/DeploymentDialog.vue';
import ValidationPanel from './components/ValidationPanel.vue';
import WorkflowInitDialog from './components/WorkflowInitDialog.vue';
import WorkflowStatusBar from './components/WorkflowStatusBar.vue';
import UiTemplatePanel from './components/UiTemplatePanel.vue';

const router = useRouter();
const route = useRoute();
const graph = useWorkflowGraph();

// ── 核心状态 ──
const workflow = reactive<NodeWorkflowDefinition>({
  name: '',
  slots: [],
  nodes: [],
  edges: [],
  uiTemplates: []
});

const savedSnapshot = ref('');
const isDirty = computed(() => {
  const current = JSON.stringify({
    name: workflow.name,
    slots: workflow.slots,
    nodes: workflow.nodes,
    edges: workflow.edges,
    uiTemplates: workflow.uiTemplates
  });
  return current !== savedSnapshot.value;
});

// ── UI 状态 ──
const saving = ref(false);
const validating = ref(false);
const deployLoading = ref(false);
const selectedSlotId = ref<string | null>(null);
const selectedNodeId = ref<string | null>(null);
const slotDialogVisible = ref(false);
const editingSlotId = ref<string | null>(null);
const showDeployDialog = ref(false);
const validationVisible = ref(false);
const validationErrors = ref<string[]>([]);
const validationWarnings = ref<string[]>([]);
const initDialogVisible = ref(false);

const boardTypes = ref<Array<{ board: string; label: string }>>([]);
const deviceOptions = ref<
  Array<{ deviceId: string; name: string; status: string; board: string }>
>([]);
const capabilityNodesBySlot = ref<Record<string, CapabilityNodeDefinition[]>>({});
const boardEventsBySlot = ref<Record<string, Array<{ eventId: string; displayName?: string; description?: string }>>>({});
const uiTemplateDetails = ref<Array<{
  templateKey: string;
  name: string;
  variables: Array<{ variableKey: string; sectionId: string; field: string }>;
}>>([]);

// ── 计算属性 ──
const selectedNode = computed<NodeWorkflowNode | null>(() => {
  if (!selectedNodeId.value) return null;
  return workflow.nodes.find((n) => n.nodeId === selectedNodeId.value) || null;
});

const selectedCapDef = computed<CapabilityNodeDefinition | null>(() => {
  const node = selectedNode.value;
  if (!node) return null;
  const definitions = capabilityNodesBySlot.value[node.slotId] || [];
  return definitions.find((item) =>
    item.nodeType === node.nodeType &&
    (!node.params.nodeId || item.instanceId === node.params.nodeId)
  ) || definitions.find((item) => item.nodeType === node.nodeType) || null;
});

const editingSlot = computed<NodeWorkflowSlot | undefined>(() => {
  if (!editingSlotId.value) return undefined;
  return workflow.slots.find((s) => s.slotId === editingSlotId.value);
});

const selectedNodeBoardEvents = computed(() => {
  if (!selectedNode.value) return [];
  return boardEventsBySlot.value[selectedNode.value.slotId] || [];
});

// ── 生命周期 ──
onMounted(async () => {
  await Promise.all([loadBoardTypes(), loadDevices(), loadUiTemplates()]);

  const workflowId = route.query.id as string;
  if (workflowId) {
    await loadWorkflow(workflowId);
  } else {
    initEmpty();
    initDialogVisible.value = true;
  }
});

// ── 数据加载 ──
async function loadBoardTypes() {
  try {
    const res: any = await getBoardTypes();
    const items = Array.isArray(res?.data) ? res.data : [];
    boardTypes.value = items.map((item: any) => ({
      board: String(item.board || ''),
      label: String(item.label || item.board || '')
    }));
  } catch {
    boardTypes.value = [];
  }
}

async function loadDevices() {
  try {
    const res: any = await getDeviceList({ page: 0, size: 200 });
    const items = Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data)
        ? res.data
        : [];
    deviceOptions.value = items.map((item: any) => ({
      deviceId: String(item.deviceId || ''),
      name: String(item.name || ''),
      status: String(item.status || ''),
      board: String(item.board || '')
    }));
  } catch {
    deviceOptions.value = [];
  }
}

async function loadUiTemplates() {
  try {
    const response: any = await listTemplates();
    const items = Array.isArray(response?.data) ? response.data : [];
    const details = await Promise.allSettled(
      items.map((item: any) => getTemplate(String(item.id || item.templateId || '')))
    );
    uiTemplateDetails.value = details.flatMap((result, index) => {
      if (result.status !== 'fulfilled') return [];
      const data: any = result.value?.data || result.value;
      const definition = data?.definition || {};
      return [{
        templateKey: String(data?.templateKey || items[index]?.templateKey || ''),
        name: String(data?.name || items[index]?.name || ''),
        variables: Array.isArray(definition.variables)
          ? definition.variables.map((item: any) => ({
            variableKey: String(item.variableKey || ''),
            sectionId: String(item.sectionId || ''),
            field: String(item.field || '')
          }))
          : []
      }];
    }).filter((item) => item.templateKey);
  } catch {
    uiTemplateDetails.value = [];
  }
}

async function loadWorkflow(workflowId: string) {
  try {
    const res: any = await getWorkflow(workflowId);
    const data = res?.data || res;
    const definition = data?.definition || data;
    workflow.name = data?.name || definition?.name || '';
    workflow.id = data?.id || data?.workflowId || workflowId;
    workflow.slots = Array.isArray(definition?.slots) ? definition.slots : [];
    workflow.nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
    workflow.edges = Array.isArray(definition?.edges) ? definition.edges : [];
    workflow.uiTemplates = Array.isArray(definition?.uiTemplates)
      ? definition.uiTemplates
      : [];
    await loadCapabilitiesForSlots(workflow.slots);
    markSaved();
    rebuildGraph();
    selectedSlotId.value = workflow.slots[0]?.slotId || null;
  } catch {
    ElMessage.error('加载工作流失败');
    initEmpty();
  }
}

async function loadCapabilitiesForSlots(slots: NodeWorkflowSlot[]) {
  const results = await Promise.allSettled(
    slots.map((slot) => getCapabilityNodesForBoardType(slot.board))
  );
  const next = { ...capabilityNodesBySlot.value };
  results.forEach((result, index) => {
    const slot = slots[index];
    if (!slot) return;
    if (result.status !== 'fulfilled') {
      next[slot.slotId] = [];
      return;
    }
    const response: any = result.value;
    next[slot.slotId] = Array.isArray(response?.data?.nodes)
      ? response.data.nodes
      : Array.isArray(response?.nodes)
        ? response.nodes
        : [];
  });
  capabilityNodesBySlot.value = next;

  // 并行加载各板卡的事件目录（供 section.trigger 配置使用）
  const eventResults = await Promise.allSettled(
    slots.map((slot) => getBoardTypeEvents(slot.board))
  );
  const nextEvents = { ...boardEventsBySlot.value };
  eventResults.forEach((result, index) => {
    const slot = slots[index];
    if (!slot) return;
    if (result.status !== 'fulfilled') {
      nextEvents[slot.slotId] = [];
      return;
    }
    const response: any = result.value;
    const events = Array.isArray(response?.data?.events)
      ? response.data.events
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.events)
          ? response.events
          : [];
    nextEvents[slot.slotId] = events.map((item: any) => ({
      eventId: String(item.eventId || item.id || ''),
      displayName: String(item.displayName || item.label || item.name || ''),
      description: String(item.description || '')
    }));
  });
  boardEventsBySlot.value = nextEvents;
}

function initEmpty() {
  workflow.name = '新工作流';
  workflow.id = undefined;
  workflow.slots = [];
  workflow.nodes = [];
  workflow.edges = [];
  workflow.uiTemplates = [];
  markSaved();
  rebuildGraph();
}

function initializeWorkflow(payload: { name: string; slot: NodeWorkflowSlot }) {
  workflow.name = payload.name;
  workflow.slots = [payload.slot];
  selectedSlotId.value = payload.slot.slotId;
  initDialogVisible.value = false;
  rebuildGraph();
}

// ── 画布操作 ──
function rebuildGraph() {
  const capDefsMap = Object.values(capabilityNodesBySlot.value)
    .flat()
    .reduce<Record<string, CapabilityNodeDefinition>>((map, item) => {
      map[item.nodeType] = item;
      return map;
    }, {});
  graph.buildGraph(workflow.nodes, workflow.edges, workflow.slots, capDefsMap);
}

function onNodesUpdated(nodes: any[]) {
  graph.vueFlowNodes.value = nodes;
  workflow.nodes = nodes.map((n) => ({
    nodeId: n.id,
    slotId: (n.data as any)?.slotId || '',
    nodeType: (n.data as any)?.nodeType || '',
    params: (n.data as any)?.params || {}
  }));
}

function onEdgesUpdated(edges: any[]) {
  graph.vueFlowEdges.value = edges;
  workflow.edges = edges.map((e) => ({
    from: e.source,
    to: e.target
  }));
}

function onConnect(connection: Connection) {
  const newEdge: NodeWorkflowEdge = {
    from: connection.source,
    to: connection.target
  };
  // 去重
  const exists = workflow.edges.some(
    (e) => e.from === newEdge.from && e.to === newEdge.to
  );
  if (!exists) {
    workflow.edges.push(newEdge);
    rebuildGraph();
  }
}

function onNodeClick(nodeId: string) {
  selectedNodeId.value = nodeId;
}

function onDrop(payload: {
  type: string;
  instanceId?: string;
  slotId: string;
  position: { x: number; y: number };
}) {
  const definition = (capabilityNodesBySlot.value[payload.slotId] || [])
    .find((item) =>
      item.nodeType === payload.type &&
      (!payload.instanceId || item.instanceId === payload.instanceId)
    );
  if (!definition) {
    ElMessage.warning('节点能力定义尚未加载');
    return;
  }
  addCapabilityNode(definition, payload.slotId, payload.position);
}

function addNodeFromPalette(definition: CapabilityNodeDefinition) {
  if (!selectedSlotId.value) return;
  addCapabilityNode(definition, selectedSlotId.value);
}

function addCapabilityNode(
  definition: CapabilityNodeDefinition,
  slotId: string,
  position?: { x: number; y: number }
) {
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newNode: NodeWorkflowNode = {
    nodeId,
    slotId,
    nodeType: definition.nodeType,
    params: buildDefaultParams(definition, slotId)
  };
  workflow.nodes.push(newNode);
  selectedNodeId.value = nodeId;
  rebuildGraph();
  if (position) {
    graph.vueFlowNodes.value = graph.vueFlowNodes.value.map((item) =>
      item.id === nodeId ? { ...item, position } : item
    );
  }
}

function buildDefaultParams(definition: CapabilityNodeDefinition, slotId: string) {
  const params: Record<string, unknown> = {};
  for (const parameter of definition.parameters || []) {
    const name = String(parameter.name || '');
    if (name && Object.prototype.hasOwnProperty.call(parameter, 'default')) {
      params[name] = parameter.default;
    }
  }
  if (definition.nodeType === 'button.trigger') {
    const source = definition.source as Record<string, unknown>;
    const events = Array.isArray(source?.events)
      ? source.events as Array<Record<string, unknown>>
      : [];
    params.eventId = String(events[0]?.eventId || '');
    params.nodeId = definition.instanceId;
  }
  if (definition.nodeType === 'section.trigger') {
    const source = definition.source as Record<string, unknown>;
    const events = Array.isArray(source?.events || source?.sectionEvents)
      ? (source?.events || source?.sectionEvents) as Array<Record<string, unknown>>
      : [];
    params.eventId = String(events[0]?.eventId || events[0]?.id || '');
    params.sectionId = '';
    params.nodeId = '';
  }
  if (definition.nodeType === 'ui.update') {
    const binding = workflow.uiTemplates.find((item) => String(item.slotId || '') === slotId);
    const templateKey = String(binding?.templateKey || '');
    const template = uiTemplateDetails.value.find((item) => item.templateKey === templateKey);
    params.slotId = slotId;
    params.templateKey = templateKey;
    params.variableKey = template?.variables[0]?.variableKey || '';
    params.value = '';
  }
  return params;
}

function onCapabilityNodesLoaded(payload: { slotId: string; nodes: CapabilityNodeDefinition[] }) {
  capabilityNodesBySlot.value = {
    ...capabilityNodesBySlot.value,
    [payload.slotId]: payload.nodes
  };
  rebuildGraph();
}

function updateNodeParams(nodeId: string, params: Record<string, unknown>) {
  const node = workflow.nodes.find((item) => item.nodeId === nodeId);
  if (!node) return;
  node.params = params;
  graph.updateNodeParams(nodeId, params);
}

function removeNode(nodeId: string) {
  workflow.nodes = workflow.nodes.filter((n) => n.nodeId !== nodeId);
  workflow.edges = workflow.edges.filter(
    (e) => e.from !== nodeId && e.to !== nodeId
  );
  selectedNodeId.value = null;
  rebuildGraph();
}

// ── 槽位操作 ──
function openSlotDialog(slotId?: string) {
  editingSlotId.value = slotId || null;
  slotDialogVisible.value = true;
}

async function onSlotConfirm(slot: NodeWorkflowSlot) {
  if (editingSlotId.value) {
    const idx = workflow.slots.findIndex(
      (s) => s.slotId === editingSlotId.value
    );
    if (idx >= 0) {
      workflow.slots[idx] = slot;
    }
  } else {
    // 检查重复
    if (workflow.slots.some((s) => s.slotId === slot.slotId)) {
      ElMessage.warning('槽位 ID 已存在');
      return;
    }
    workflow.slots.push(slot);
  }
  slotDialogVisible.value = false;
  selectedSlotId.value = slot.slotId;
  await loadCapabilitiesForSlots([slot]);
  rebuildGraph();
}

function removeSlot(slotId: string) {
  // 删除该槽位下的所有节点
  const removedNodeIds = workflow.nodes
    .filter((n) => n.slotId === slotId)
    .map((n) => n.nodeId);
  workflow.nodes = workflow.nodes.filter((n) => n.slotId !== slotId);
  workflow.edges = workflow.edges.filter(
    (e) =>
      !removedNodeIds.includes(e.from) && !removedNodeIds.includes(e.to)
  );
  workflow.slots = workflow.slots.filter((s) => s.slotId !== slotId);
  workflow.uiTemplates = workflow.uiTemplates.filter(
    (item) => String(item.slotId || '') !== slotId
  );
  delete capabilityNodesBySlot.value[slotId];
  delete boardEventsBySlot.value[slotId];
  if (selectedSlotId.value === slotId) {
    selectedSlotId.value = null;
  }
  rebuildGraph();
}

// ── 保存 / 校验 ──
function markSaved() {
  savedSnapshot.value = JSON.stringify({
    name: workflow.name,
    slots: workflow.slots,
    nodes: workflow.nodes,
    edges: workflow.edges,
    uiTemplates: workflow.uiTemplates
  });
}

async function saveWorkflow() {
  const errors = validateDraft();
  if (errors.length) {
    validationErrors.value = errors;
    validationWarnings.value = [];
    validationVisible.value = true;
    ElMessage.warning('请先完成工作流编排');
    return;
  }

  const payload: NodeWorkflowDefinition = {
    name: workflow.name,
    slots: workflow.slots,
    nodes: workflow.nodes,
    edges: workflow.edges,
    uiTemplates: workflow.uiTemplates
  };

  saving.value = true;
  try {
    const validationResponse: any = await validateWorkflow(payload);
    const validation = validationResponse?.data || validationResponse;
    const backendErrors = Array.isArray(validation?.errors) ? validation.errors : [];
    if (backendErrors.length) {
      validationErrors.value = backendErrors;
      validationWarnings.value = [];
      validationVisible.value = true;
      ElMessage.warning('工作流校验未通过');
      return;
    }
    if (workflow.id) {
      await updateWorkflow(workflow.id, payload);
    } else {
      const res: any = await createWorkflow(payload);
      workflow.id = res?.data?.id || res?.data?.workflowId || res?.id || res?.workflowId;
      // 更新 URL
      if (workflow.id) {
        router.replace({ query: { id: workflow.id }});
      }
    }
    markSaved();
    ElMessage.success('保存成功');
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

function requestDeploy() {
  if (!workflow.id || isDirty.value) {
    ElMessage.warning('请先保存当前工作流定义');
    return;
  }
  showDeployDialog.value = true;
}

function validateDraft() {
  const errors: string[] = [];
  if (!workflow.name.trim()) errors.push('请输入工作流名称');
  if (!workflow.slots.length) errors.push('请至少添加一个设备槽位');
  if (!workflow.nodes.length) errors.push('请从能力节点列表拖入节点');
  const triggerNodeTypes = ['button.trigger', 'section.trigger'];
  if (!workflow.nodes.some((node) => triggerNodeTypes.includes(node.nodeType))) {
    errors.push('请至少添加一个触发节点（button.trigger 或 section.trigger）');
  }
  for (const trigger of workflow.nodes.filter((node) => triggerNodeTypes.includes(node.nodeType))) {
    if (!String(trigger.params.eventId || '')) {
      errors.push(`触发节点 ${trigger.nodeId} 尚未选择事件`);
    }
  }
  if (!workflow.nodes.some((node) => !triggerNodeTypes.includes(node.nodeType))) {
    errors.push('请至少添加一个输出节点');
  }
  if (!workflow.edges.length) errors.push('请连接触发节点和输出节点');
  for (const binding of workflow.uiTemplates) {
    if (!String(binding.slotId || '')) errors.push('UI 模板绑定缺少槽位');
    if (!String(binding.templateKey || '')) errors.push('UI 模板绑定缺少模板');
  }
  for (const node of workflow.nodes.filter((item) => item.nodeType === 'ui.update')) {
    if (!String(node.params.templateKey || '')) {
      errors.push(`UI 更新节点 ${node.nodeId} 尚未选择模板`);
    }
    if (!String(node.params.variableKey || '')) {
      errors.push(`UI 更新节点 ${node.nodeId} 尚未选择模板变量`);
    }
  }
  return errors;
}

async function validateWorkflowDef() {
  validating.value = true;
  validationErrors.value = [];
  validationWarnings.value = [];
  validationVisible.value = true;

  try {
    const res: any = await validateWorkflow({
      name: workflow.name,
      slots: workflow.slots,
      nodes: workflow.nodes,
      edges: workflow.edges,
      uiTemplates: workflow.uiTemplates
    });

    const data = res?.data || res;
    validationErrors.value = Array.isArray(data?.errors) ? data.errors : [];
    validationWarnings.value = Array.isArray(data?.warnings)
      ? data.warnings
      : [];
  } catch {
    validationErrors.value = ['校验请求失败'];
  } finally {
    validating.value = false;
  }
}

// ── 部署 ──
async function onDeploy(bindings: Record<string, string>) {
  if (!workflow.id) {
    ElMessage.warning('请先保存工作流');
    return;
  }

  deployLoading.value = true;
  try {
    const res: any = await deployWorkflow(workflow.id, {
      slotBindings: bindings
    });
    showDeployDialog.value = false;
    const inspection = res?.data?.inspection || res?.inspection;
    const replacedCount = (
      res?.data?.replacedDeployments || res?.replacedDeployments || []
    ).length;

    if (inspection?.errors?.length) {
      validationErrors.value = inspection.errors;
      validationWarnings.value = inspection.warnings || [];
      validationVisible.value = true;
      ElMessage.error('部署失败，存在校验错误');
    } else {
      let msg = '部署成功';
      if (replacedCount) {
        msg += `，已替换 ${replacedCount} 个冲突部署`;
      }
      ElMessage.success(msg);
      if (inspection?.warnings?.length) {
        validationErrors.value = [];
        validationWarnings.value = inspection.warnings;
        validationVisible.value = true;
      }
    }
  } catch {
    ElMessage.error('部署失败');
  } finally {
    deployLoading.value = false;
  }
}

// ── 导航 ──
function goBack() {
  router.push({ name: 'SduiNodeWorkflows' });
}
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 84px);
  background: #f5f7fb;
}

.editor-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.canvas-guide {
  position: absolute;
  top: 50%;
  left: calc(50% + 130px);
  z-index: 2;
  width: 360px;
  padding: 20px;
  transform: translate(-50%, -50%);
  border: 1px dashed rgba(22, 119, 255, 0.35);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  text-align: center;
  pointer-events: none;
}

.canvas-guide strong {
  color: #122033;
}

.canvas-guide p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.editor-sidebar {
  width: 260px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid rgba(18, 32, 51, 0.08);
  overflow-y: auto;
}
</style>
