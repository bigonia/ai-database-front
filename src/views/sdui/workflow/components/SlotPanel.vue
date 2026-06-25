<template>
  <div class="slot-panel">
    <div class="panel-header">
      <strong>槽位</strong>
      <el-button size="small" type="primary" text @click="$emit('addSlot')">
        + 添加
      </el-button>
    </div>

    <div
      v-for="slot in slots"
      :key="slot.slotId"
      class="slot-item"
      :class="{ selected: slot.slotId === selectedSlotId }"
      @click="$emit('selectSlot', slot.slotId)"
      @dblclick="$emit('editSlot', slot.slotId)"
    >
      <div class="slot-info">
        <span class="slot-name">{{ slot.displayName || slot.slotId }}</span>
        <span class="slot-type">{{ slot.board }}</span>
      </div>
      <el-button
        size="small"
        type="danger"
        text
        @click.stop="$emit('removeSlot', slot.slotId)"
      >
        ×
      </el-button>
    </div>

    <el-empty
      v-if="!slots.length"
      description="暂无槽位"
      :image-size="32"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  slots: NodeWorkflowSlot[];
  selectedSlotId: string | null;
}>();

defineEmits<{
  addSlot: [];
  editSlot: [slotId: string];
  removeSlot: [slotId: string];
  selectSlot: [slotId: string];
}>();
</script>

<style scoped>
.slot-panel {
  padding: 12px 0;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  margin-bottom: 8px;
}

.slot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.slot-item:hover {
  background: rgba(22, 119, 255, 0.06);
}

.slot-item.selected {
  background: rgba(22, 119, 255, 0.12);
  font-weight: 600;
}

.slot-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slot-name {
  font-size: 13px;
  color: #122033;
}

.slot-type {
  font-size: 11px;
  color: #8c8c8c;
  font-family: Menlo, Monaco, Consolas, monospace;
}
</style>
