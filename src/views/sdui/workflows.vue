<template>
  <div class="app-container sdui-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>工作流定义</span>
          <el-button type="primary" @click="openEditor()">新建工作流</el-button>
        </div>
      </template>

      <el-table v-loading="loading.list" :data="workflows">
        <el-table-column prop="id" label="ID" min-width="160" show-overflow-tooltip />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="icon" label="图标" width="80" />
        <el-table-column label="触发器" width="70" align="center">
          <template #default="{ row }">{{ getDefStat(row, 'triggers') }}</template>
        </el-table-column>
        <el-table-column label="动作" width="70" align="center">
          <template #default="{ row }">{{ getDefStat(row, 'actions') }}</template>
        </el-table-column>
        <el-table-column label="页面" width="60" align="center">
          <template #default="{ row }">{{ getDefStat(row, 'pages') }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditor(row.id)">编辑</el-button>
            <el-button link type="success" @click="openEditDialog(row)">属性</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="dialogs.form"
      title="编辑工作流属性"
      width="520px"
      destroy-on-close
    >
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="ID">
          <el-input v-model="form.id" disabled />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="图标标识，如 mail、star" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.form = false">取消</el-button>
        <el-button type="primary" :loading="loading.save" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  deleteWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowDefinitions,
  updateWorkflowDefinition
} from '@/api/sdui';

export default {
  name: 'SduiWorkflows',
  data() {
    return {
      loading: {
        list: false,
        save: false
      },
      workflows: [],
      editingId: '',
      form: {
        id: '',
        name: '',
        icon: ''
      },
      dialogs: {
        form: false
      }
    };
  },
  created() {
    this.refreshList();
  },
  activated() {
    this.refreshList();
  },
  methods: {
    async refreshList() {
      this.loading.list = true;
      try {
        const res = await getWorkflowDefinitions();
        this.workflows = Array.isArray(res?.data) ? res.data : [];
      } catch {
        ElMessage.error('加载工作流列表失败');
      } finally {
        this.loading.list = false;
      }
    },
    async openEditDialog(row) {
      this.editingId = row.id;
      try {
        const res = await getWorkflowDefinition(row.id);
        const data = res?.data || {};
        this.form = {
          id: data.id || row.id,
          name: data.name || row.name,
          icon: data.icon || row.icon || ''
        };
      } catch {
        ElMessage.error('加载工作流详情失败');
      }
      this.dialogs.form = true;
    },
    async handleSave() {
      if (!this.form.name.trim()) {
        ElMessage.warning('名称不能为空');
        return;
      }

      this.loading.save = true;
      try {
        const existing = await getWorkflowDefinition(this.editingId);
        const payload = {
          id: this.editingId,
          name: this.form.name.trim(),
          icon: this.form.icon.trim() || undefined,
          definitionJson: existing?.data?.definitionJson || '{}'
        };
        await updateWorkflowDefinition(this.editingId, payload);
        ElMessage.success('工作流已更新');
        this.dialogs.form = false;
        await this.refreshList();
      } catch {
        ElMessage.error('保存失败');
      } finally {
        this.loading.save = false;
      }
    },
    async handleDelete(row) {
      try {
        await ElMessageBox.confirm(
          `确定删除工作流 "${row.name || row.id}" 吗？此操作不可撤销。`,
          '确认删除',
          { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
        );
      } catch {
        return;
      }

      try {
        await deleteWorkflowDefinition(row.id);
        ElMessage.success('已删除');
        await this.refreshList();
      } catch {
        ElMessage.error('删除失败');
      }
    },
    openEditor(id) {
      if (id) {
        this.$router.push({ path: `/sdui/editor/${id}` });
      } else {
        this.$router.push({ path: '/sdui/editor' });
      }
    },
    getDefStat(row, key) {
      try {
        const def = typeof row.definitionJson === 'string'
          ? JSON.parse(row.definitionJson)
          : (row.definitionJson || {});
        if (key === 'triggers') return (def.triggers || []).length;
        if (key === 'actions') {
          const actions = def.actions || {};
          return Object.values(actions).reduce((sum, arr) => sum + (arr || []).length, 0);
        }
        if (key === 'pages') return (def.pages || []).length;
      } catch {
        return '-';
      }
      return '-';
    }
  }
};
</script>

<style scoped>
.sdui-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
