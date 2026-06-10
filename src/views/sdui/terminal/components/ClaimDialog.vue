<template>
  <el-dialog
    :model-value="visible"
    title="认领设备"
    width="440px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-width="80px">
      <el-form-item label="Device ID">
        <el-input :model-value="deviceId" disabled />
      </el-form-item>
      <el-form-item label="认领码" required>
        <el-input
          v-model="claimCode"
          maxlength="12"
          placeholder="设备上显示的 4-12 位认领码"
        />
      </el-form-item>
      <el-form-item label="设备名称">
        <el-input
          v-model="deviceName"
          maxlength="100"
          placeholder="可选，给设备起个名字"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('confirm', deviceId, claimCode, deviceName)">
        确认认领
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  deviceId: string
  submitting: boolean
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [deviceId: string, claimCode: string, deviceName: string]
}>();

const claimCode = ref('');
const deviceName = ref('');

watch(
  () => props.visible,
  (v) => {
    if (!v) {
      claimCode.value = '';
      deviceName.value = '';
    }
  }
);
</script>
