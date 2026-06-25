<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <el-button
        v-if="backRoute"
        text
        @click="$emit('back')"
      >
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <span class="workflow-name">{{ workflowName }}</span>
      <el-tag v-if="isDirty" size="small" type="warning">未保存</el-tag>
    </div>

    <div class="toolbar-right">
      <el-button
        :loading="saving"
        :disabled="!isDirty"
        type="primary"
        @click="$emit('save')"
      >
        保存
      </el-button>
      <el-button
        :loading="validating"
        @click="$emit('validate')"
      >
        校验
      </el-button>
      <el-button
        :loading="deploying"
        type="success"
        @click="$emit('deploy')"
      >
        部署
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue';

defineProps<{
  workflowName: string;
  isDirty: boolean;
  saving: boolean;
  validating: boolean;
  deploying: boolean;
  backRoute?: boolean;
}>();

defineEmits<{
  back: [];
  save: [];
  validate: [];
  deploy: [];
}>();
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 18px;
  background: #fff;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 16px 16px 0 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workflow-name {
  font-size: 16px;
  font-weight: 700;
  color: #122033;
}
</style>
