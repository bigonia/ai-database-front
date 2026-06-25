<template>
  <div class="custom-node" :style="{ borderColor: data.modeColor }">
    <!-- 槽位标签 -->
    <div class="node-slot-badge" :style="{ background: data.modeColor }">
      {{ data.slotLabel }}
    </div>

    <!-- 运行模式标签 -->
    <div class="node-mode-tag" :style="{ color: data.modeColor }">
      {{ data.modeLabel }}
    </div>

    <!-- 节点类型名称 -->
    <div class="node-type-label">{{ data.displayName }}</div>
    <div class="node-connect-hint">
      <span v-if="data.inputPorts.length">输入</span>
      <span v-if="data.outputPorts.length">输出</span>
    </div>

    <!-- 输入端口手柄（左侧） -->
    <Handle
      v-for="port in data.inputPorts"
      :key="port.id"
      :id="port.id"
      type="target"
      :position="Position.Left"
      :style="handleStyle(port)"
      :title="port.displayName"
    />

    <!-- 输出端口手柄（右侧） -->
    <Handle
      v-for="port in data.outputPorts"
      :key="port.id"
      :id="port.id"
      type="source"
      :position="Position.Right"
      :style="handleStyle(port)"
      :title="port.displayName"
    />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

const props = defineProps<{
  data: {
    nodeId: string;
    slotId: string;
    slotLabel: string;
    nodeType: string;
    displayName: string;
    runtimeMode: string;
    modeColor: string;
    modeLabel: string;
    params: Record<string, unknown>;
    inputPorts: CapabilityNodePort[];
    outputPorts: CapabilityNodePort[];
  };
}>();

const { data } = props;

function handleStyle(port: CapabilityNodePort) {
  return {
    borderColor: data.modeColor,
    backgroundColor: port.required ? data.modeColor : '#fff'
  };
}
</script>

<style scoped>
.custom-node {
  min-width: 180px;
  max-width: 240px;
  padding: 10px 12px;
  border: 2px solid #1677ff;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  position: relative;
}

.node-slot-badge {
  position: absolute;
  top: -10px;
  left: 12px;
  padding: 1px 10px;
  border-radius: 10px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-mode-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.node-type-label {
  font-weight: 600;
  color: #122033;
  word-break: break-all;
}

.node-connect-hint {
  display: flex;
  justify-content: space-between;
  min-height: 14px;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 9px;
}
</style>
