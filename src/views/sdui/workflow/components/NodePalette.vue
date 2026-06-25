<template>
  <div class="node-palette">
    <div class="panel-header">
      <strong>能力节点</strong>
      <span v-if="paletteSlotLabel" class="palette-slot-label">
        {{ paletteSlotLabel }}
      </span>
    </div>

    <div v-if="!selectedSlotId" class="palette-hint">
      请先选择或创建一个槽位
    </div>

    <div v-else-if="loading" class="palette-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>

    <div v-else>
      <div
        v-for="group in groupedNodes"
        :key="group.mode"
        class="node-group"
      >
        <div class="group-title" :style="{ color: group.color }">
          {{ group.label }}
        </div>
        <div
          v-for="node in group.nodes"
          :key="node.instanceId || node.nodeType"
          class="palette-node"
          draggable="true"
          @dragstart="onDragStart($event, node)"
          @dblclick="$emit('addNode', node)"
        >
          <span
            class="node-dot"
            :style="{ background: group.color }"
          ></span>
          <div class="node-text">
            <span class="node-display-name">{{ node.displayName }}</span>
            <span class="node-desc">{{ node.description }}</span>
          </div>
        </div>
      </div>

      <el-empty
        v-if="!hasNodes"
        description="该板卡类型暂无可用节点"
        :image-size="32"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { getCapabilityNodesForBoardType } from '@/api/capability-node';
import { RUNTIME_MODE_COLORS, RUNTIME_MODE_LABELS } from '../composables/useWorkflowGraph';

const props = defineProps<{
  selectedSlotId: string | null;
  slots: NodeWorkflowSlot[];
}>();

const emit = defineEmits<{
  addNode: [def: CapabilityNodeDefinition];
  loaded: [payload: { slotId: string; nodes: CapabilityNodeDefinition[] }];
}>();

const loading = ref(false);
const capabilityNodes = ref<CapabilityNodeDefinition[]>([]);

const selectedSlot = computed(() =>
  props.slots.find((s) => s.slotId === props.selectedSlotId)
);

const paletteSlotLabel = computed(() => {
  const slot = selectedSlot.value;
  if (!slot) return '';
  return `${slot.board} — ${slot.displayName || slot.slotId}`;
});

const groupedNodes = computed(() => {
  const groups: Record<
    string,
    {
      mode: string;
      label: string;
      color: string;
      nodes: CapabilityNodeDefinition[];
    }
  > = {};

  for (const node of capabilityNodes.value) {
    const mode = String(node.runtimeMode || 'action').toUpperCase();
    if (!groups[mode]) {
      groups[mode] = {
        mode,
        label: RUNTIME_MODE_LABELS[mode] || mode,
        color: RUNTIME_MODE_COLORS[mode] || '#8c8c8c',
        nodes: []
      };
    }
    groups[mode].nodes.push(node);
  }

  // 固定顺序：TRIGGER → ACTION → SESSION → UI_PATCH
  const order = ['TRIGGER', 'ACTION', 'SESSION', 'UI_PATCH'];
  return order
    .filter((m) => groups[m])
    .map((m) => groups[m]);
});

const hasNodes = computed(() => capabilityNodes.value.length > 0);

watch(
  () => props.selectedSlotId,
  async (slotId) => {
    if (!slotId) {
      capabilityNodes.value = [];
      return;
    }
    const slot = props.slots.find((s) => s.slotId === slotId);
    if (!slot?.board) return;

    loading.value = true;
    try {
      const res: any = await getCapabilityNodesForBoardType(slot.board);
      capabilityNodes.value = Array.isArray(res?.data?.nodes)
        ? res.data.nodes
        : Array.isArray(res?.nodes)
          ? res.nodes
          : [];
      emit('loaded', { slotId, nodes: capabilityNodes.value });
    } catch {
      capabilityNodes.value = [];
      emit('loaded', { slotId, nodes: [] });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

function onDragStart(event: DragEvent, node: CapabilityNodeDefinition) {
  event.dataTransfer!.effectAllowed = 'move';
  event.dataTransfer!.setData(
    'application/json',
    JSON.stringify({
      type: node.nodeType,
      instanceId: node.instanceId,
      slotId: props.selectedSlotId
    })
  );
}
</script>

<style scoped>
.node-palette {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
  margin-bottom: 8px;
}

.palette-slot-label {
  font-size: 11px;
  color: #8c8c8c;
}

.palette-hint,
.palette-loading {
  padding: 24px 12px;
  text-align: center;
  color: #8c8c8c;
  font-size: 13px;
}

.node-group {
  margin-bottom: 4px;
}

.group-title {
  padding: 6px 12px 2px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.palette-node {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  margin: 2px 6px;
  border-radius: 8px;
  cursor: grab;
  transition: background 0.15s;
}

.palette-node:hover {
  background: rgba(22, 119, 255, 0.06);
}

.palette-node:active {
  cursor: grabbing;
}

.node-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.node-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.node-display-name {
  font-size: 13px;
  font-weight: 500;
  color: #122033;
}

.node-desc {
  font-size: 11px;
  color: #8c8c8c;
  line-height: 1.3;
}
</style>
