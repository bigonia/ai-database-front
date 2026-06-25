<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑槽位' : '添加槽位'"
    width="480px"
    @close="$emit('close')"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="onConfirm"
    >
      <el-form-item label="槽位 ID" prop="slotId">
        <el-input
          v-model="form.slotId"
          placeholder="如：device_a、screen_1"
          :disabled="isEdit"
        />
      </el-form-item>
      <el-form-item label="板卡类型" prop="board">
        <el-select
          v-model="form.board"
          placeholder="选择板卡类型"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="bt in boardTypes"
            :key="bt.board"
            :label="bt.label || bt.board"
            :value="bt.board"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="显示名" prop="displayName">
        <el-input
          v-model="form.displayName"
          placeholder="如：主设备、副屏"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onConfirm">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

interface BoardType {
  board: string;
  label?: string;
}

const props = defineProps<{
  visible: boolean;
  isEdit: boolean;
  boardTypes: BoardType[];
  initialData?: NodeWorkflowSlot;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [slot: NodeWorkflowSlot];
}>();

const formRef = ref<FormInstance>();
const saving = ref(false);

const form = reactive({
  slotId: props.initialData?.slotId || '',
  board: props.initialData?.board || '',
  displayName: props.initialData?.displayName || ''
});

const rules: FormRules = {
  slotId: [
    { required: true, message: '请输入槽位 ID', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '槽位 ID 只能包含字母、数字、下划线和连字符',
      trigger: 'blur'
    }
  ],
  board: [{ required: true, message: '请选择板卡类型', trigger: 'change' }],
  displayName: [
    { required: true, message: '请输入显示名', trigger: 'blur' }
  ]
};

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    form.slotId = props.initialData?.slotId || '';
    form.board = props.initialData?.board || '';
    form.displayName = props.initialData?.displayName || '';
  }
);

async function onConfirm() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    emit('confirm', {
      slotId: form.slotId,
      board: form.board,
      displayName: form.displayName,
      requiredCapabilities: []
    });
  } finally {
    saving.value = false;
  }
}
</script>
