<template>
  <div class="workflow-canvas-wrapper">
    <VueFlow
      v-model:nodes="localNodes"
      v-model:edges="localEdges"
      :node-types="nodeTypes"
      :default-edge-options="defaultEdgeOptions"
      :connection-line-style="connectionLineStyle"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      fit-view-on-init
      @connect="onConnect"
      @node-click="onNodeClick"
      @edges-change="onEdgesChange"
      @node-drag-start="dragging = true"
      @node-drag-stop="onNodeDragStop"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <Background :gap="20" />
      <Controls position="bottom-right" />
      <div class="canvas-help">
        拖动节点可调整位置；从节点右侧圆点拖到目标节点左侧圆点建立连线
      </div>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { markRaw, nextTick, shallowRef, watch } from 'vue';
import {
  VueFlow,
  useVueFlow
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import type {
  Node,
  Edge,
  Connection,
  NodeDragEvent
} from '@vue-flow/core';
import CustomNode from './CustomNode.vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

const props = defineProps<{
  nodes: Node[];
  edges: Edge[];
}>();

const emit = defineEmits<{
  'update:nodes': [nodes: Node[]];
  'update:edges': [edges: Edge[]];
  connect: [connection: Connection];
  nodeClick: [nodeId: string];
  drop: [payload: { type: string; instanceId?: string; slotId: string; position: { x: number; y: number } }];
}>();

const nodeTypes = markRaw({ custom: markRaw(CustomNode) });
const defaultEdgeOptions = { type: 'smoothstep', animated: false };
const connectionLineStyle = { stroke: '#1677ff', strokeWidth: 2 };
const localNodes = shallowRef<Node[]>([...props.nodes]);
const localEdges = shallowRef<Edge[]>([...props.edges]);
const dragging = shallowRef(false);

const { screenToFlowCoordinate } = useVueFlow();

watch(
  () => props.nodes,
  (nodes) => {
    if (!dragging.value) localNodes.value = [...nodes];
  }
);

watch(
  () => props.edges,
  (edges) => {
    localEdges.value = [...edges];
  }
);

function onConnect(connection: Connection) {
  emit('connect', connection);
}

function onNodeClick({ node }: { node: Node }) {
  emit('nodeClick', node.id);
}

function onNodeDragStop(event: NodeDragEvent) {
  dragging.value = false;
  const movedNodes = new Map(event.nodes.map((node) => [node.id, node.position]));
  localNodes.value = localNodes.value.map((node) => ({
    ...node,
    position: movedNodes.get(node.id) || node.position
  }));
  emit('update:nodes', [...localNodes.value]);
}

async function onEdgesChange() {
  await nextTick();
  emit('update:edges', [...localEdges.value]);
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const raw = event.dataTransfer.getData('application/json');
  if (!raw) return;

  try {
    const payload = JSON.parse(raw);
    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY
    });
    emit('drop', { ...payload, position });
  } catch {
    // ignore invalid drops
  }
}
</script>

<style scoped>
.workflow-canvas-wrapper {
  flex: 1;
  height: 100%;
  min-height: 500px;
  border-radius: 16px;
  overflow: hidden;
  background: #fafbfc;
  border: 1px solid rgba(18, 32, 51, 0.08);
}

.canvas-help {
  position: absolute;
  right: 16px;
  top: 14px;
  z-index: 4;
  padding: 7px 11px;
  border: 1px solid rgba(22, 119, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #64748b;
  font-size: 11px;
  pointer-events: none;
}
</style>

<!-- Vue Flow 全局样式（非 scoped，因为 Vue Flow 渲染在组件外部） -->
<style>
.vue-flow {
  background: #fafbfc;
}

.vue-flow__node-custom {
  cursor: grab;
}

.vue-flow__node-custom.dragging {
  cursor: grabbing;
}

.vue-flow__node-custom.selected {
  box-shadow: 0 0 0 2px #1677ff;
}

.vue-flow__edge-path {
  stroke: #b0b0b0;
  stroke-width: 2;
}

.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #1677ff;
}

.vue-flow__connection-line {
  stroke: #1677ff;
  stroke-width: 2;
}

.vue-flow__handle {
  width: 14px !important;
  height: 14px !important;
  border-width: 3px !important;
  cursor: crosshair;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.vue-flow__handle:hover {
  transform: scale(1.25);
}

.vue-flow__controls {
  border-radius: 8px;
  overflow: hidden;
}
</style>
