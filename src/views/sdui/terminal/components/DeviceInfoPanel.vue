<template>
  <el-card shadow="never" class="info-panel">
    <template #header>
      <div class="panel-header">
        <span>基础信息</span>
        <el-button size="small" @click="startEdit">编辑</el-button>
      </div>
    </template>

    <el-descriptions :column="3" border size="small">
      <el-descriptions-item label="Device ID">
        <code>{{ detail.deviceId }}</code>
      </el-descriptions-item>
      <el-descriptions-item label="名称">{{ detail.name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="detail.status === 'ONLINE' ? 'success' : 'info'" size="small">
          {{ detail.status || '-' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="注册状态">{{ detail.registrationStatus || '-' }}</el-descriptions-item>
      <el-descriptions-item label="板卡">{{ detail.board || '-' }}</el-descriptions-item>
      <el-descriptions-item label="屏幕">
        {{ detail.screenWidth }}×{{ detail.screenHeight }}
        {{ detail.screenShape ? `(${detail.screenShape})` : '' }}
      </el-descriptions-item>
      <el-descriptions-item label="输入方式">{{ detail.inputMode || '-' }}</el-descriptions-item>
      <el-descriptions-item label="尺寸级别">
        <el-tag size="small">{{ detail.sizeClass || '-' }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="当前会话">{{ detail.sessionId || '-' }}</el-descriptions-item>
      <el-descriptions-item label="连接次数">{{ detail.connectionCount ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="连接时间">{{ formatTime(detail.connectedAt) }}</el-descriptions-item>
      <el-descriptions-item label="最近在线">{{ formatTime(detail.lastSeenAt) }}</el-descriptions-item>
      <el-descriptions-item label="认领时间">{{ formatTime(detail.claimedAt) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ detail.notes || '-' }}</el-descriptions-item>
    </el-descriptions>

    <!-- Inline edit dialog for name/notes -->
    <el-dialog
      v-model="editing"
      title="编辑设备信息"
      width="400px"
      destroy-on-close
    >
      <el-form label-width="60px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" maxlength="100" placeholder="设备名称" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.notes"
            type="textarea"
            maxlength="500"
            placeholder="备注信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const props = defineProps<{
  detail: SduiDeviceDetailResponse
  saving: boolean
}>();

const emit = defineEmits<{
  save: [data: { name?: string; notes?: string }]
}>();

const editing = ref(false);
const editForm = reactive({ name: '', notes: '' });

function startEdit() {
  editForm.name = props.detail.name || '';
  editForm.notes = props.detail.notes || '';
  editing.value = true;
}

function handleSave() {
  emit('save', {
    name: editForm.name.trim() || undefined,
    notes: editForm.notes.trim() || undefined
  });
  editing.value = false;
}

function formatTime(val: string | null | undefined): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.info-panel {
  margin-bottom: 16px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
code {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
