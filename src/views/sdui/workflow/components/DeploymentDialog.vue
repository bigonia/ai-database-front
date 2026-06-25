<template>
  <el-dialog
    :model-value="visible"
    title="部署工作流"
    width="560px"
    @close="$emit('close')"
  >
    <div v-if="!slots.length" class="deploy-empty">
      <el-empty description="工作流中暂无槽位，请先添加槽位" :image-size="48" />
    </div>

    <el-form
      v-else
      ref="formRef"
      label-position="top"
      @submit.prevent="onDeploy"
    >
      <el-alert
        title="将每个槽位绑定到一台真实设备，确认后即部署运行。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />

      <el-form-item
        v-for="slot in slots"
        :key="slot.slotId"
        :label="`${slot.displayName || slot.slotId} (${slot.board})`"
      >
        <el-select
          v-model="bindings[slot.slotId]"
          placeholder="选择设备"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="device in getDevicesForType(slot.board)"
            :key="device.deviceId"
            :label="`${device.name || device.deviceId} (${device.deviceId})`"
            :value="device.deviceId"
          >
            <span style="float: left">{{ device.name || device.deviceId }}</span>
            <span style="float: right; color: #8492a6; font-size: 12px">
              {{ device.deviceId }}
              <el-tag
                :type="device.status === 'ONLINE' ? 'success' : 'info'"
                size="small"
                style="margin-left: 8px"
              >
                {{ device.status === 'ONLINE' ? '在线' : '离线' }}
              </el-tag>
            </span>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button
        type="primary"
        :loading="deploying"
        :disabled="!slots.length"
        @click="onDeploy"
      >
        部署
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';

interface DeviceOption {
  deviceId: string;
  name: string;
  status: string;
  board: string;
}

const props = defineProps<{
  visible: boolean;
  slots: NodeWorkflowSlot[];
  devices: DeviceOption[];
}>();

const emit = defineEmits<{
  close: [];
  deploy: [bindings: Record<string, string>];
}>();

const formRef = ref();
const deploying = ref(false);
const bindings = reactive<Record<string, string>>({});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // 重置绑定
      Object.keys(bindings).forEach((k) => delete bindings[k]);
    }
  }
);

function getDevicesForType(board: string): DeviceOption[] {
  return props.devices.filter((d) => d.board === board);
}

async function onDeploy() {
  const unbound = props.slots.filter((s) => !bindings[s.slotId]);
  if (unbound.length) {
    ElMessage.warning(
      `请为以下槽位选择设备：${unbound.map((s) => s.displayName || s.slotId).join(', ')}`
    );
    return;
  }

  deploying.value = true;
  try {
    emit('deploy', { ...bindings });
  } finally {
    deploying.value = false;
  }
}
</script>
