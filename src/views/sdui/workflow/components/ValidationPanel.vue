<template>
  <el-dialog
    :model-value="visible"
    title="校验结果"
    width="560px"
    @close="$emit('close')"
  >
    <div v-if="loading" style="text-align: center; padding: 24px">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <p style="margin-top: 8px; color: #8c8c8c">正在校验...</p>
    </div>

    <template v-else-if="errors.length || warnings.length">
      <el-alert
        v-if="errors.length"
        :title="`${errors.length} 个错误`"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      />
      <el-alert
        v-if="warnings.length"
        :title="`${warnings.length} 个警告`"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      />

      <div class="validation-list">
        <div
          v-for="(err, i) in errors"
          :key="'e-' + i"
          class="validation-item error"
        >
          <el-icon><CircleCloseFilled /></el-icon>
          <span>{{ err }}</span>
        </div>
        <div
          v-for="(warn, i) in warnings"
          :key="'w-' + i"
          class="validation-item warning"
        >
          <el-icon><WarningFilled /></el-icon>
          <span>{{ warn }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <el-result icon="success" title="校验通过" sub-title="工作流定义无错误" />
    </template>

    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { Loading, CircleCloseFilled, WarningFilled } from '@element-plus/icons-vue';

defineProps<{
  visible: boolean;
  loading: boolean;
  errors: string[];
  warnings: string[];
}>();

defineEmits<{
  close: [];
}>();
</script>

<style scoped>
.validation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.validation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.validation-item.error {
  background: rgba(245, 108, 108, 0.08);
  color: #c45656;
}

.validation-item.warning {
  background: rgba(230, 162, 60, 0.08);
  color: #b88230;
}
</style>
