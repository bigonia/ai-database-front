<template>
  <div class="app-container">
    <!-- 1. 顶部搜索与操作栏 (卡片式) -->
    <el-card class="filter-card" shadow="hover">
      <div class="filter-container">
        <div class="filter-left">
          <el-input 
            v-model="listQuery.name" 
            placeholder="搜索数据源名称" 
            style="width: 220px;" 
            class="filter-item" 
            :prefix-icon="Search"
            clearable
            @keyup.enter="handleFilter" 
          />
          <el-select 
            v-model="listQuery.type" 
            placeholder="数据库类型" 
            clearable 
            class="filter-item" 
            style="width: 160px"
          >
            <el-option v-for="item in dbTypeOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-button v-waves class="filter-item" type="primary" :icon="Search" @click="handleFilter">
            搜索
          </el-button>
        </div>
        <div class="filter-right">
          <el-button class="filter-item" type="success" :icon="Plus" @click="handleCreate">
            新增数据源
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 2. 数据表格 (卡片式) -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="listLoading"
        :data="list"
        border
        fit
        highlight-current-row
        stripe
        style="width: 100%;"
        :header-cell-style="{ background: '#f5f7fa', color: '#606266', fontWeight: 'bold' }"
      >
        <el-table-column label="ID" prop="id" sortable="custom" align="center" width="80">
          <template #default="{row}">
            <span class="id-text">#{{ row.id }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="名称" prop="name" min-width="160px">
          <template #default="{row}">
            <span class="link-type" @click="handleUpdate(row)">
              <el-icon class="icon-margin"><DataBoard /></el-icon>
              {{ row.name }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getTagType(row.type)" effect="light" round size="small">
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="连接信息" min-width="200px" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="conn-info">
              <span><el-icon><Monitor /></el-icon> {{ row.host }}:{{ row.port }}</span>
              <span v-if="row.databaseName" class="db-name">
                <el-icon><Coin /></el-icon> {{ row.databaseName }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="更新时间" width="180px" align="center">
          <template #default="{row}">
            <span class="time-text">{{ row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" align="center" width="280" class-name="small-padding fixed-width">
          <template #default="{row, $index}">
            <el-tooltip content="查看Schema/表结构" placement="top">
              <el-button type="warning" size="small" circle :icon="Files" @click="handleOpenStructure(row)" />
            </el-tooltip>
            
            <el-tooltip content="编辑配置" placement="top">
              <el-button type="primary" size="small" circle :icon="Edit" @click="handleUpdate(row)" />
            </el-tooltip>

            <el-tooltip content="测试连接" placement="top">
              <el-button type="success" size="small" circle :icon="Link" @click="handleTestConnection(row)" />
            </el-tooltip>

            <el-tooltip content="删除" placement="top">
              <el-button size="small" type="danger" circle :icon="Delete" @click="handleDelete(row, $index)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <!-- 3. 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-show="total>0"
          v-model:current-page="listQuery.page"
          v-model:page-size="listQuery.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="getList"
          @current-change="getList"
        />
      </div>
    </el-card>

    <!-- 4. 创建/编辑 弹窗 -->
    <el-dialog 
      v-model="dialogFormVisible" 
      :title="textMap[dialogStatus]" 
      width="650px"
      destroy-on-close
      custom-class="datasource-dialog"
    >
      <el-form ref="dataForm" :rules="rules" :model="temp" label-position="top" style="padding: 0 10px;">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="数据源名称" prop="name">
              <el-input v-model="temp.name" placeholder="请输入唯一标识名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据库类型" prop="type">
              <el-select v-model="temp.type" placeholder="选择类型" style="width: 100%">
                <el-option v-for="item in dbTypeOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="描述说明" prop="description">
          <el-input v-model="temp.description" type="textarea" :rows="2" placeholder="用于备注该数据源的用途..." />
        </el-form-item>

        <div class="form-section-title">连接配置</div>
        
        <el-row :gutter="24">
          <el-col :span="16">
            <el-form-item label="主机地址 (Host)" prop="host">
              <el-input v-model="temp.host" placeholder="127.0.0.1" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="端口 (Port)" prop="port">
              <el-input-number v-model="temp.port" :min="1" :max="65535" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="数据库名 (Database)" prop="databaseName">
              <el-input v-model="temp.databaseName" placeholder="可选" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户名 (Username)" prop="username">
              <el-input v-model="temp.username" placeholder="root" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="密码 (Password)" prop="password">
          <el-input v-model="temp.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>

        <el-collapse accordion style="border: none;">
          <el-collapse-item title="高级设置 (额外属性 JSON)" name="1">
            <el-input
              v-model="extraPropsString"
              type="textarea"
              :rows="3"
              placeholder='{"useSSL": "false", "serverTimezone": "Asia/Shanghai"}'
            />
          </el-collapse-item>
        </el-collapse>

      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取消</el-button>
          <el-button 
            type="warning" 
            plain 
            :loading="testConnLoading" 
            :icon="Link" 
            @click="handleTestConnectionInDialog"
          >
            测试连接
          </el-button>
          <el-button type="primary" @click="dialogStatus==='create'?createData():updateData()">
            确认保存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 5. 结构管理抽屉 (Drawer) -->
    <el-drawer
      v-model="drawerVisible"
      size="45%"
      destroy-on-close
      :show-close="true"
      custom-class="structure-drawer"
    >
      <template #header>
        <div class="drawer-custom-header">
          <div class="header-icon">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="header-info">
            <span class="header-title">{{ currentDatasource.name }}</span>
            <span class="header-subtitle">结构浏览与文档化</span>
          </div>
          <el-tag size="small" effect="dark" class="header-tag">{{ currentDatasource.type }}</el-tag>
        </div>
      </template>

      <div class="drawer-body" v-loading="structureLoading">
        <!-- 顶部工具条 -->
        <div class="drawer-toolbar">
           <el-select 
            v-model="currentSchema" 
            placeholder="请选择 Schema" 
            style="width: 200px"
            class="schema-select"
            @change="handleSchemaChange"
          >
            <template #prefix>
              <el-icon><Files /></el-icon>
            </template>
            <el-option v-for="s in schemaList" :key="s" :label="s" :value="s" />
          </el-select>

           <el-button type="success" plain :icon="Document" @click="handleGenerateMetadata">
             生成全库画像
           </el-button>
        </div>

        <el-divider content-position="left" class="custom-divider">
          <span v-if="currentSchema">Schema: {{ currentSchema }} 的数据表</span>
          <span v-else>请先选择 Schema</span>
        </el-divider>

        <!-- Table 列表 -->
        <div class="table-list-wrapper" v-if="currentSchema">
          <el-table 
            :data="tableList" 
            v-loading="tableLoading"
            style="width: 100%;"
            height="calc(100vh - 250px)"
            @expand-change="handleTableExpand"
            row-key="tableName"
            :show-header="true"
            class="structure-table"
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="columns-expand-panel">
                  <div class="expand-title">
                    <el-icon><Grid /></el-icon> 字段列表 (Columns)
                  </div>
                  <div v-if="row.columns && row.columns.length > 0" class="column-chips">
                    <el-tag 
                      v-for="col in row.columns" 
                      :key="col" 
                      class="col-tag" 
                      size="small" 
                      type="info"
                      effect="plain"
                    >
                      {{ col }}
                    </el-tag>
                  </div>
                  <div v-else v-loading="row.loadingColumns" class="loading-text">
                    {{ row.loadingColumns ? '正在读取元数据...' : '暂无列信息或读取失败' }}
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="表名" prop="tableName">
              <template #default="{ row }">
                 <span class="table-name-text">{{ row.tableName }}</span>
              </template>
            </el-table-column>

            <el-table-column align="right" width="120">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleOpenStream(row)">
                  <el-icon class="icon-margin"><Cpu /></el-icon> 流式化
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <el-empty v-else description="请从上方下拉框选择一个 Schema 以开始浏览" :image-size="100" />
      </div>
    </el-drawer>

    <!-- 6. 流式化配置弹窗 -->
    <el-dialog v-model="streamDialogVisible" title="表数据流式化配置" width="600px" append-to-body destroy-on-close>
      <div class="stream-dialog-content">
        <el-alert
          title="功能说明"
          type="info"
          :closable="false"
          show-icon
          class="mb-4"
        >
          <template #default>
            系统将读取 <b>{{ currentStreamTable }}</b> 表的所有行，根据下方模版生成文档流。
            点击绿色字段标签可快速插入变量。
          </template>
        </el-alert>
        
        <div class="field-picker">
          <div class="picker-label">可用字段:</div>
          <div class="field-chips-container" v-if="currentTableColumns.length">
             <el-tag 
               v-for="col in currentTableColumns" 
               :key="col" 
               class="field-chip cursor-pointer"
               type="success"
               effect="light"
               @click="insertFieldToTemplate(col)"
             >
               + {{ col }}
             </el-tag>
          </div>
          <div v-else class="text-gray">加载字段中...</div>
        </div>

        <div class="template-editor">
           <div class="picker-label">文档模版:</div>
           <el-input
             ref="templateInputRef"
             v-model="streamTemplate"
             type="textarea"
             :rows="6"
             placeholder="例如：\n用户 ${username} (ID: ${id}) 的职业是 ${job_title}，入职时间为 ${hire_date}。"
           />
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="streamDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="streamSubmitting" @click="submitStreamTask">
            提交任务
          </el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<script>
import { ref, reactive, toRefs, computed, nextTick, onMounted } from 'vue';
import { 
  Search, Edit, Delete, Link, Files, Document, Cpu, Plus, 
  DataBoard, Monitor, Coin, DataLine, Grid 
} from '@element-plus/icons-vue';
import { ElNotification, ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import {
  fetchList,
  createDatasource,
  updateDatasource,
  deleteDatasource,
  testConnectionByData,
  testConnectionById,
  getSchemas,
  getTables,
  getColumns,
  generateMetadata,
  streamTable
} from '@/api/datasource';
import waves from '@/directive/waves';

export default {
  name: 'DatasourceManagement',
  directives: { waves },
  components: { 
    DataBoard, Monitor, Coin, DataLine, Grid, Cpu, Document, Files 
  },
  setup() {
    const dataForm = ref(null);
    const dbTypeOptions = ['MYSQL', 'POSTGRESQL', 'SQLSERVER', 'SQLITE', 'ORACLE'];
    const textMap = { update: '编辑数据源', create: '新增数据源' };
    
    const state = reactive({
      list: [],
      total: 0,
      listLoading: true,
      listQuery: { page: 1, limit: 10, name: undefined, type: undefined },
      dialogFormVisible: false,
      dialogStatus: '',
      testConnLoading: false,
      temp: { 
        id: undefined, name: '', type: 'MYSQL', description: '', 
        host: 'localhost', port: 3306, databaseName: '', 
        username: 'root', password: '', extraProperties: {} 
      },
      rules: { 
        name: [{ required: true, message: '请输入名称', trigger: 'blur' }], 
        type: [{ required: true, message: '请选择类型', trigger: 'change' }], 
        host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }], 
        port: [{ required: true, message: '请输入端口', trigger: 'blur' }] 
      }
    });

    // 抽屉与结构相关状态
    const structureState = reactive({
      drawerVisible: false,
      structureLoading: false,
      currentDatasource: {},
      schemaList: [],
      currentSchema: '',
      tableLoading: false,
      tableList: [],
      streamDialogVisible: false,
      currentStreamTable: '',
      currentTableColumns: [],
      streamTemplate: '',
      streamSubmitting: false
    });

    const templateInputRef = ref(null);

    // 计算属性: JSON转换
    const extraPropsString = computed({
      get: () => {
        if (!state.temp.extraProperties || Object.keys(state.temp.extraProperties).length === 0) return '';
        try { return JSON.stringify(state.temp.extraProperties, null, 2); } catch { return ''; }
      },
      set: (val) => {
        if (!val || val.trim() === '') { state.temp.extraProperties = {}; return; }
        try { state.temp.extraProperties = JSON.parse(val); } catch (e) { console.warn('JSON parsing error'); }
      }
    });

    // --- 辅助方法 ---
    const getTagType = (dbType) => {
      switch (dbType) { 
        case 'MYSQL': return ''; 
        case 'POSTGRESQL': return 'success'; 
        case 'SQLSERVER': return 'warning'; 
        case 'ORACLE': return 'danger'; 
        default: return 'info'; 
      }
    };

    const getList = () => {
      state.listLoading = true;
      fetchList(state.listQuery).then(response => {
        const payload = response.data || response;
        if (Array.isArray(payload)) { state.list = payload; state.total = payload.length; }
        else if (payload && payload.items) { state.list = payload.items; state.total = payload.total; }
        else { state.list = []; state.total = 0; }
        state.listLoading = false;
      }).catch(() => { state.list = []; state.total = 0; state.listLoading = false; });
    };

    // --- 事件处理 ---
    const handleFilter = () => { state.listQuery.page = 1; getList(); };
    
    const resetTemp = () => { 
      state.temp = { 
        id: undefined, name: '', type: 'MYSQL', description: '', 
        host: 'localhost', port: 3306, databaseName: '', 
        username: 'root', password: '', extraProperties: {} 
      }; 
    };

    const handleCreate = () => { 
      resetTemp(); 
      state.dialogStatus = 'create'; 
      state.dialogFormVisible = true; 
      nextTick(() => dataForm.value?.clearValidate()); 
    };

    const createData = () => {
      dataForm.value.validate(valid => {
        if(valid) {
          const d = {...state.temp}; delete d.id;
          createDatasource(d).then(res => {
            state.list.unshift(res.data || res);
            state.dialogFormVisible = false;
            ElMessage.success('创建成功');
          });
        }
      });
    };

    const handleUpdate = (row) => {
      state.temp = { ...row, extraProperties: { ...(row.extraProperties || {}) }};
      state.dialogStatus = 'update';
      state.dialogFormVisible = true;
      nextTick(() => dataForm.value?.clearValidate());
    };

    const updateData = () => {
      dataForm.value.validate(valid => {
        if(valid) {
          updateDatasource(state.temp.id, state.temp).then(res => {
            const idx = state.list.findIndex(v=>v.id===state.temp.id);
            if(idx!==-1) state.list.splice(idx,1,res.data||state.temp);
            state.dialogFormVisible = false;
            ElMessage.success('更新成功');
          });
        }
      });
    };

    const handleDelete = (row, index) => {
      ElMessageBox.confirm(`确认删除数据源 [${row.name}] 吗?`, '删除警告', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        deleteDatasource(row.id).then(() => {
          state.list.splice(index, 1);
          ElMessage.success('删除成功');
        });
      });
    };

    // --- 优化后的测试连接逻辑 ---
    // 列表页测试
    const handleTestConnection = (row) => {
      const loading = ElLoading.service({
        lock: true,
        text: `正在测试连接 [${row.name}] ...`,
        background: 'rgba(0, 0, 0, 0.6)',
      });
      
      testConnectionById(row.id).then(() => {
        loading.close();
        // 成功提示：使用 ElMessage.success 确保可见
        ElMessage({
          message: `连接成功！数据源 [${row.name}] 可正常访问。`,
          type: 'success',
          duration: 4000,
          showClose: true
        });
      }).catch(err => {
        loading.close();
        // 失败提示：保留 Notification 以便查看长错误信息
        ElNotification({
          title: '连接失败',
          message: err.message || '网络或配置错误',
          type: 'error',
          duration: 5000
        });
      });
    };

    // 弹窗内测试
    const handleTestConnectionInDialog = () => {
      dataForm.value.validate(valid => {
        if (valid) {
          state.testConnLoading = true;
          testConnectionByData(state.temp).then(() => {
            state.testConnLoading = false;
            ElMessage({
              message: '测试通过！当前配置可以成功连接。',
              type: 'success',
              duration: 4000,
              showClose: true
            });
          }).catch(err => {
            state.testConnLoading = false;
            ElNotification({
              title: '连接失败',
              message: err.message || '请检查配置信息',
              type: 'error',
              duration: 5000
            });
          });
        } else {
          ElMessage.warning('请先完善必填项 (名称、主机、端口、类型)');
        }
      });
    };

    // --- 结构管理逻辑 ---
    const handleOpenStructure = (row) => {
      structureState.currentDatasource = row;
      structureState.drawerVisible = true;
      structureState.currentSchema = '';
      structureState.schemaList = [];
      structureState.tableList = [];
      
      structureState.structureLoading = true;
      getSchemas(row.id).then(res => {
        structureState.schemaList = res.data || res || [];
        structureState.structureLoading = false;
      }).catch(err => {
        structureState.structureLoading = false;
        ElMessage.error('无法获取 Schema 列表: ' + err.message);
      });
    };

    const handleSchemaChange = (val) => {
      if (!val) return;
      structureState.tableLoading = true;
      structureState.tableList = [];
      
      getTables(structureState.currentDatasource.id, val).then(res => {
        const tables = res.data || res || [];
        structureState.tableList = tables.map(t => ({
          tableName: t,
          columns: [],
          loadingColumns: false
        }));
        structureState.tableLoading = false;
      }).catch(() => {
        structureState.tableLoading = false;
        ElMessage.error('表列表加载失败');
      });
    };

    const handleTableExpand = (row, expandedRows) => {
      const isExpanded = expandedRows.some(r => r.tableName === row.tableName);
      if (isExpanded && (!row.columns || row.columns.length === 0)) {
        row.loadingColumns = true;
        getColumns(structureState.currentDatasource.id, structureState.currentSchema, row.tableName)
          .then(res => {
            row.columns = res.data || res || [];
            row.loadingColumns = false;
          })
          .catch(() => {
            row.loadingColumns = false;
            row.columns = ['(加载失败)'];
          });
      }
    };

    const handleGenerateMetadata = () => {
      ElMessageBox.confirm('全库扫描将生成完整的元数据文档，这可能需要几十秒，确定开始吗？', '确认', {
        type: 'info'
      }).then(() => {
        const loading = ElLoading.service({ text: '任务提交中...' });
        generateMetadata(structureState.currentDatasource.id).then(() => {
          loading.close();
          ElMessage.success('元数据生成任务已后台启动');
        }).catch(err => {
          loading.close();
          ElMessage.error(err.message);
        });
      });
    };

    const handleOpenStream = (row) => {
      structureState.currentStreamTable = row.tableName;
      structureState.currentTableColumns = row.columns || [];
      structureState.streamTemplate = '';
      structureState.streamDialogVisible = true;
      
      // 自动补全列信息
      if (structureState.currentTableColumns.length === 0) {
         getColumns(structureState.currentDatasource.id, structureState.currentSchema, row.tableName)
           .then(res => {
             const cols = res.data || res || [];
             structureState.currentTableColumns = cols;
             row.columns = cols;
           });
      }
    };

    const insertFieldToTemplate = (field) => {
      structureState.streamTemplate += `\${${field}}`;
    };

    const submitStreamTask = () => {
      if (!structureState.streamTemplate) {
        ElMessage.warning('请填写文档模版');
        return;
      }
      structureState.streamSubmitting = true;
      streamTable(
        structureState.currentDatasource.id, 
        structureState.currentSchema, 
        structureState.currentStreamTable, 
        structureState.streamTemplate
      ).then(() => {
        structureState.streamSubmitting = false;
        structureState.streamDialogVisible = false;
        ElMessage.success('流式化任务提交成功');
      }).catch(err => {
        structureState.streamSubmitting = false;
        ElMessage.error(err.message);
      });
    };

    onMounted(getList);

    return {
      ...toRefs(state),
      ...toRefs(structureState),
      dataForm, templateInputRef, extraPropsString,
      getList, handleFilter, handleCreate, createData, handleUpdate, updateData, handleDelete,
      getTagType, handleTestConnection, handleTestConnectionInDialog,
      handleOpenStructure, handleSchemaChange, handleTableExpand, handleGenerateMetadata,
      handleOpenStream, insertFieldToTemplate, submitStreamTask,
      // Icons
      Search, Edit, Delete, Link, Files, Document, Cpu, Plus, DataBoard, Monitor, Coin, DataLine, Grid,
      dbTypeOptions, textMap
    };
  }
};
</script>

<style scoped>
/* 容器调整 */
.app-container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}

/* 搜索栏卡片 */
.filter-card {
  margin-bottom: 20px;
  border: none;
}
.filter-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-left, .filter-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-item {
  margin-bottom: 0; /* 覆盖默认 */
}

/* 表格卡片 */
.table-card {
  border: none;
}
.id-text {
  font-family: monospace;
  color: #909399;
}
.link-type {
  color: #409EFF;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
}
.link-type:hover {
  text-decoration: underline;
}
.icon-margin {
  margin-right: 4px;
}
.conn-info {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #606266;
}
.conn-info span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.db-name {
  color: #909399;
  font-size: 12px;
}
.time-text {
  color: #909399;
  font-size: 13px;
}

/* 分页 */
.pagination-container {
  margin-top: 20px;
  text-align: right;
}

/* 弹窗优化 */
.form-section-title {
  font-size: 14px;
  font-weight: bold;
  color: #303133;
  margin: 15px 0 10px;
  padding-left: 8px;
  border-left: 3px solid #409EFF;
}

/* 抽屉自定义样式 */
.drawer-custom-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 10px;
}
.header-icon {
  font-size: 24px;
  color: #409EFF;
}
.header-info {
  display: flex;
  flex-direction: column;
}
.header-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
.header-subtitle {
  font-size: 12px;
  color: #909399;
}
.drawer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.custom-divider {
  margin: 15px 0;
}
.columns-expand-panel {
  padding: 15px 20px;
  background-color: #fafafa;
  border-radius: 4px;
}
.expand-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
}
.column-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.loading-text {
  color: #c0c4cc;
  font-size: 12px;
}
.table-name-text {
  font-weight: 500;
  color: #303133;
}

/* 流式化弹窗 */
.mb-4 {
  margin-bottom: 16px;
}
.field-picker {
  margin-bottom: 16px;
}
.picker-label {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
}
.field-chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  border: 1px dashed #dcdfe6;
}
.field-chip {
  transition: all 0.3s;
}
.field-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.cursor-pointer {
  cursor: pointer;
}
.text-gray {
  color: #909399;
  font-size: 12px;
}
</style>