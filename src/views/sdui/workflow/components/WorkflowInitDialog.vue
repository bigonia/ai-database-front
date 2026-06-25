<template>
  <el-dialog
    :model-value="visible"
    title="创建工作流"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <el-alert
      title="先定义工作流名称和第一个设备槽位，随后从该板卡能力目录添加节点。"
      type="info"
      :closable="false"
      show-icon
      class="init-alert"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="工作流名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：按键控制灯光" />
      </el-form-item>
      <el-form-item label="槽位 ID" prop="slotId">
        <el-input v-model="form.slotId" placeholder="例如：main_device" />
      </el-form-item>
      <el-form-item label="槽位名称" prop="displayName">
        <el-input v-model="form.displayName" placeholder="例如：主设备" />
      </el-form-item>
      <el-form-item label="板卡类型" prop="board">
        <el-select v-model="form.board" filterable placeholder="选择板卡类型" style="width: 100%">
          <el-option
            v-for="item in boardTypes"
            :key="item.board"
            :label="item.label || item.board"
            :value="item.board"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('cancel')">返回列表</el-button>
      <el-button type="primary" @click="submit">开始编排</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

defineProps<{
  visible: boolean;
  boardTypes: Array<{ board: string; label: string }>;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [payload: { name: string; slot: NodeWorkflowSlot }];
}>();

const formRef = ref<FormInstance>();
const form = reactive({
  name: '新工作流',
  slotId: 'main_device',
  displayName: '主设备',
  board: ''
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入工作流名称', trigger: 'blur' }],
  slotId: [
    { required: true, message: '请输入槽位 ID', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '槽位 ID 只能包含字母、数字、下划线和连字符',
      trigger: 'blur'
    }
  ],
  displayName: [{ required: true, message: '请输入槽位名称', trigger: 'blur' }],
  board: [{ required: true, message: '请选择板卡类型', trigger: 'change' }]
};

async function submit() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  emit('confirm', {
    name: form.name.trim(),
    slot: {
      slotId: form.slotId.trim(),
      displayName: form.displayName.trim(),
      board: form.board,
      requiredCapabilities: []
    }
  });
}
</script>

<style scoped>
.init-alert {
  margin-bottom: 18px;
}
</style>
