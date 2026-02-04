<template>
  <div class="app-container">
    <!-- 1. 顶部工具栏 -->
    <div class="filter-container">
      <div class="filter-left">
        <el-input
          v-model="listQuery.name"
          placeholder="搜索 Agent 名称"
          style="width: 200px;"
          class="filter-item"
          @keyup.enter="handleFilter"
          clearable
          @clear="handleFilter"
        />
        <el-button class="filter-item" type="primary" :icon="Search" @click="handleFilter">
          搜索
        </el-button>
      </div>
      
      <div class="filter-right">
        <el-button class="filter-item" style="margin-left: 10px;" type="success" :icon="Setting" @click="handleModelConfig">
          模型配置
        </el-button>
        <el-button class="filter-item" type="primary" :icon="Plus" @click="handleCreate">
          新建 Agent
        </el-button>
      </div>
    </div>

    <!-- 2. Agent 列表 -->
    <el-table
      v-loading="listLoading"
      :data="filteredList"
      border
      fit
      highlight-current-row
      style="width: 100%;"
    >
      <el-table-column label="ID" prop="id" align="center" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="link-type" @click="handleUpdate(row)">{{ row.id }}</span>
        </template>
      </el-table-column>
      
      <!-- 优化宽度：名称列不再占据过多空间 -->
      <el-table-column label="名称" prop="name" width="180" show-overflow-tooltip />
      
      <el-table-column label="绑定模型" width="150" align="center">
        <template #default="{ row }">
          <el-tag>{{ row.modelName }}</el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="已启用工具" align="center" min-width="120">
        <template #default="{ row }">
          <el-tag v-if="row.toolNames && row.toolNames.length" type="info" effect="plain">
            共 {{ row.toolNames.length }} 个
          </el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>

      <el-table-column label="Advisor" min-width="200">
         <template #default="{ row }">
          <div v-if="row.advisors && row.advisors.length">
             <el-tag v-for="adv in row.advisors" :key="adv" type="warning" size="small" style="margin-right:4px">{{ adv }}</el-tag>
          </div>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" align="center" width="180" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="handleUpdate(row)">
            编辑
          </el-button>
          <el-button type="danger" size="small" link @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 3. 模型配置弹窗 (Dialog) -->
    <el-dialog v-model="modelDialogVisible" title="模型资源配置" width="600px">
      <div class="model-section">
        <h4 class="section-title">已注册模型</h4>
        <div class="model-tags" v-loading="modelsLoading">
          <el-tag
            v-for="model in availableModels"
            :key="model"
            closable
            class="model-tag"
            @close="handleDeleteModel(model)"
          >
            {{ model }}
          </el-tag>
          <el-empty v-if="availableModels.length === 0" description="暂无可用模型" :image-size="40" />
        </div>
      </div>

      <div class="model-section" style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
        <h4 class="section-title">注册新模型</h4>
        <el-form ref="modelFormRef" :model="modelForm" :rules="modelRules" label-width="100px" size="small">
          <el-form-item label="注册别名" prop="registrationName">
            <el-input v-model="modelForm.registrationName" placeholder="系统内显示的唯一名称 (如: my-gpt4)" />
          </el-form-item>
          <el-form-item label="模型名称" prop="modelName">
            <el-input v-model="modelForm.modelName" placeholder="厂商实际模型名 (如: gpt-4-turbo)" />
          </el-form-item>
          <el-form-item label="API Key" prop="apiKey">
            <el-input v-model="modelForm.apiKey" type="password" show-password placeholder="sk-..." />
          </el-form-item>
          <el-form-item label="Base URL" prop="baseUrl">
            <el-input v-model="modelForm.baseUrl" placeholder="默认为官方地址，可为空" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="modelSubmitting" @click="submitModel">注册模型</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>

    <!-- 4. Agent 编辑抽屉 (Drawer) -->
    <el-drawer
      v-model="drawerVisible"
      :title="textMap[dialogStatus]"
      size="650px"
      :before-close="handleDrawerClose"
      destroy-on-close
    >
      <div class="drawer-content">
        <el-form ref="dataFormRef" :model="tempAgent" :rules="rules" label-position="top">
          <!-- 基础信息 -->
          <el-row :gutter="20">
            <!-- 仅在编辑模式显示 ID -->
            <el-col :span="12" v-if="dialogStatus === 'update'">
              <el-form-item label="Agent ID" prop="id">
                <el-input v-model="tempAgent.id" disabled placeholder="系统生成" />
              </el-form-item>
            </el-col>
            <el-col :span="dialogStatus === 'update' ? 12 : 24">
              <el-form-item label="显示名称" prop="name">
                <el-input v-model="tempAgent.name" placeholder="如: 代码专家" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="绑定模型" prop="modelName">
            <el-select v-model="tempAgent.modelName" placeholder="请选择模型" style="width: 100%">
              <el-option v-for="item in availableModels" :key="item" :label="item" :value="item" />
            </el-select>
            <div class="form-tip">若无可用模型，请先在主页“模型配置”中添加。</div>
          </el-form-item>

          <el-form-item label="系统提示词 (System Prompt)" prop="systemPrompt">
            <el-input
              v-model="tempAgent.systemPrompt"
              type="textarea"
              :rows="4"
              placeholder="你是一个智能助手... (选填)"
            />
          </el-form-item>

          <!-- 工具配置：改用表格展示 -->
          <el-form-item label="启用工具 (Tools)">
            <el-table
              ref="toolTableRef"
              :data="toolList"
              border
              size="small"
              height="250px"
              style="width: 100%"
              @selection-change="handleToolSelectionChange"
            >
              <el-table-column type="selection" width="45" align="center" />
              <el-table-column prop="name" label="工具名称" width="150" show-overflow-tooltip>
                 <template #default="{ row }">
                   <span style="font-weight: 500;">{{ row.name }}</span>
                 </template>
              </el-table-column>
              <el-table-column prop="description" label="功能描述" show-overflow-tooltip />
            </el-table>
            <div class="form-tip">勾选即代表启用该工具。</div>
          </el-form-item>

          <!-- Advisor 配置 -->
          <el-form-item label="增强能力 (Advisors)">
            <el-checkbox-group v-model="tempAgent.advisors">
              <el-checkbox v-for="adv in availableAdvisors" :key="adv" :label="adv" border>{{ adv }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>

        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="saveData">
            {{ dialogStatus === 'create' ? '立即创建' : '保存修改' }}
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, Setting, Edit, Delete } from '@element-plus/icons-vue';

// 引入 API
import {
  getAgentList,
  createAgent,
  updateAgent,
  deleteAgent,
  getModelList,
  registerModel,
  deleteModel,
  getToolList,
  getAdvisorList
} from '@/api/agent';

// --- State: Agent 列表 ---
const list = ref([]);
const listLoading = ref(true);
const listQuery = reactive({
  name: ''
});

// 计算属性：前端搜索过滤
const filteredList = computed(() => {
  if (!listQuery.name) return list.value;
  return list.value.filter(item => 
    (item.name && item.name.includes(listQuery.name)) || 
    (item.id && item.id.includes(listQuery.name))
  );
});

// --- State: 模型配置 ---
const modelDialogVisible = ref(false);
const modelsLoading = ref(false);
const modelSubmitting = ref(false);
const availableModels = ref([]); // string[]
const modelFormRef = ref(null);
const modelForm = reactive({
  registrationName: '',
  apiKey: '',
  baseUrl: '',
  modelName: '',
  temperature: 0.7,
  topP: 0.9
});
const modelRules = {
  registrationName: [{ required: true, message: '请输入注册别名', trigger: 'blur' }],
  apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }],
  modelName: [{ required: true, message: '请输入厂商模型名称', trigger: 'blur' }]
};

// --- State: Agent 编辑/新建 ---
const drawerVisible = ref(false);
const submitLoading = ref(false);
const dialogStatus = ref('create'); // 'create' | 'update'
const textMap = {
  update: '编辑 Agent',
  create: '新建 Agent'
};
const dataFormRef = ref(null);
const toolTableRef = ref(null); // 工具表格引用

// 表单临时数据
const tempAgent = reactive({
  id: '',
  name: '',
  modelName: '',
  systemPrompt: '',
  toolNames: [],
  advisors: []
});

// 校验规则 (移除 id 和 prompt 的必填)
const rules = {
  name: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  modelName: [{ required: true, message: '请选择绑定模型', trigger: 'change' }]
};

// 资源数据
const toolList = ref([]); // 完整的工具对象列表 {name, description, ...}
const availableAdvisors = ref([]);

// --- Lifecycle ---
onMounted(() => {
  fetchList();
  fetchResources();
});

// --- Methods: 列表与资源获取 ---
async function fetchList() {
  listLoading.value = true;
  try {
    const res = await getAgentList();
    list.value = Array.isArray(res) ? res : (res.data || []);
  } catch (error) {
    console.error(error);
  } finally {
    listLoading.value = false;
  }
}

async function fetchResources() {
  try {
    // 1. 获取模型
    const modelsRes = await getModelList();
    availableModels.value = Array.isArray(modelsRes) ? modelsRes : (modelsRes.data || []);

    // 2. 获取工具 (直接保存原始列表用于 Table 展示)
    const toolsRes = await getToolList();
    toolList.value = Array.isArray(toolsRes) ? toolsRes : (toolsRes.data || []);

    // 3. 获取 Advisors
    const advRes = await getAdvisorList();
    availableAdvisors.value = Array.isArray(advRes) ? advRes : (advRes.data || []);
    
  } catch (error) {
    console.error('资源加载失败', error);
  }
}

function handleFilter() {
  // 前端过滤，无需额外逻辑，computed 会自动更新
}

// --- Methods: 模型管理 ---
function handleModelConfig() {
  fetchResources();
  modelDialogVisible.value = true;
}

function handleDeleteModel(name) {
  ElMessageBox.confirm(`确定要删除模型 "${name}" 吗?`, '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteModel(name);
      ElMessage.success('删除成功');
      const res = await getModelList();
      availableModels.value = Array.isArray(res) ? res : (res.data || []);
    } catch (e) {
      // ignore
    }
  });
}

function submitModel() {
  modelFormRef.value.validate(async (valid) => {
    if (valid) {
      modelSubmitting.value = true;
      try {
        await registerModel(modelForm);
        ElMessage.success('模型注册成功');
        modelFormRef.value.resetFields();
        const res = await getModelList();
        availableModels.value = Array.isArray(res) ? res : (res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        modelSubmitting.value = false;
      }
    }
  });
}

// --- Methods: Agent CRUD ---
function resetTempAgent() {
  // 创建时不设 ID，由后端生成
  delete tempAgent.id; 
  tempAgent.name = '';
  tempAgent.modelName = '';
  tempAgent.systemPrompt = '';
  tempAgent.toolNames = [];
  tempAgent.advisors = [];
}

function handleCreate() {
  resetTempAgent();
  dialogStatus.value = 'create';
  drawerVisible.value = true;
  
  // 重置表单校验与表格选中状态
  nextTick(() => {
    dataFormRef.value?.clearValidate();
    toolTableRef.value?.clearSelection();
  });
  
  fetchResources();
}

function handleUpdate(row) {
  tempAgent.id = row.id;
  tempAgent.name = row.name;
  tempAgent.modelName = row.modelName;
  tempAgent.systemPrompt = row.systemPrompt;
  tempAgent.toolNames = row.toolNames ? [...row.toolNames] : [];
  tempAgent.advisors = row.advisors ? [...row.advisors] : [];

  dialogStatus.value = 'update';
  drawerVisible.value = true;
  
  fetchResources(); // 确保工具列表是最新的

  // 回显工具选中状态
  nextTick(() => {
    dataFormRef.value?.clearValidate();
    if (toolTableRef.value && toolList.value.length > 0) {
      toolTableRef.value.clearSelection();
      toolList.value.forEach(tool => {
        if (tempAgent.toolNames.includes(tool.name)) {
          toolTableRef.value.toggleRowSelection(tool, true);
        }
      });
    }
  });
}

// 监听工具表格选中变化，实时更新 tempAgent.toolNames
function handleToolSelectionChange(selection) {
  tempAgent.toolNames = selection.map(item => item.name);
}

function saveData() {
  dataFormRef.value.validate(async (valid) => {
    if (valid) {
      submitLoading.value = true;
      try {
        if (dialogStatus.value === 'create') {
          // 创建时不传 ID
          await createAgent(tempAgent);
          ElMessage.success('创建成功');
        } else {
          await updateAgent(tempAgent.id, tempAgent);
          ElMessage.success('更新成功');
        }
        drawerVisible.value = false;
        fetchList();
      } catch (e) {
        console.error(e);
      } finally {
        submitLoading.value = false;
      }
    }
  });
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定要删除 Agent "${row.name}" 吗?`, '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteAgent(row.id);
      ElMessage.success('删除成功');
      fetchList();
    } catch (e) {
      console.error(e);
    }
  });
}

function handleDrawerClose(done) {
  done();
}
</script>

<style scoped>
.app-container {
  padding: 20px;
  background-color: #fff;
  min-height: calc(100vh - 84px);
}

/* 顶部筛选栏 */
.filter-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-left, .filter-right {
  display: flex;
  align-items: center;
}

.filter-item {
  margin-right: 10px;
}

/* 链接样式 */
.link-type {
  color: #409EFF;
  cursor: pointer;
  font-weight: 500;
}
.link-type:hover {
  text-decoration: underline;
}

/* 模型配置弹窗 */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  border-left: 3px solid #409EFF;
  padding-left: 8px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
}

.model-tag {
  cursor: default;
}

/* 抽屉样式 */
.drawer-content {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-footer {
  margin-top: auto;
  padding-top: 20px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #e4e7ed;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
}

/* 表格内标签微调 */
.text-muted {
  color: #c0c4cc;
  font-size: 12px;
}
</style>