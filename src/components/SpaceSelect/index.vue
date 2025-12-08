<template>
  <div class="space-select-container">
    <!-- 下拉菜单触发器 -->
    <el-dropdown trigger="click" @command="handleCommand" placement="bottom-end">
      <div class="space-select-trigger">
        <el-icon class="space-icon"><OfficeBuilding /></el-icon>
        <span class="space-name" :title="currentSpaceName">{{ currentSpaceName }}</span>
        <el-icon class="caret-icon"><CaretBottom /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu class="space-dropdown-menu">
          <div class="dropdown-header">切换业务空间</div>
          <el-scrollbar max-height="260px">
            <el-dropdown-item
              v-for="item in spaceStore.spaces"
              :key="item.id"
              :command="item.id"
              :class="{ 'is-selected': item.id === spaceStore.currentSpaceId }"
            >
              <div class="space-list-item">
                <span class="item-text">{{ item.name }}</span>
                <el-icon v-if="item.id === spaceStore.currentSpaceId" class="check-icon"><Check /></el-icon>
              </div>
            </el-dropdown-item>
          </el-scrollbar>
          
          <el-divider style="margin: 5px 0;" />
          
          <el-dropdown-item command="manage" class="manage-action">
            <el-icon><Setting /></el-icon>
            <span>管理空间</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 空间管理弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="业务空间管理"
      width="700px"
      append-to-body
      class="space-manage-dialog"
    >
      <div class="manage-toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索空间名称..."
          prefix-icon="Search"
          style="width: 240px"
          clearable
        />
        <el-button type="primary" icon="Plus" @click="showCreateForm = true">新建空间</el-button>
      </div>

      <el-table 
        :data="filteredSpaces" 
        style="width: 100%;" 
        border 
        stripe
        header-cell-class-name="table-header-gray"
      >
        <el-table-column prop="name" label="空间名称" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <span>{{ row.name }}</span>
              <el-tag v-if="row.id === spaceStore.currentSpaceId" size="small" type="success" effect="light" class="ml-2">当前</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="操作" width="100" align="center">
          <template #default="scope">
            <el-button 
              type="danger" 
              link 
              icon="Delete" 
              :disabled="scope.row.id === spaceStore.currentSpaceId"
              @click="handleDelete(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 内嵌：新建空间表单 -->
      <el-dialog
        v-model="showCreateForm"
        title="新建业务空间"
        width="450px"
        append-to-body
      >
        <el-form :model="form" ref="formRef" :rules="rules" label-position="top">
          <el-form-item label="空间名称" prop="name">
            <el-input v-model="form.name" placeholder="请输入空间名称（如：研发中心）" />
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input 
              v-model="form.description" 
              type="textarea" 
              :rows="3" 
              placeholder="请输入描述信息" 
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="showCreateForm = false">取消</el-button>
            <el-button type="primary" @click="submitCreate" :loading="loading">确认创建</el-button>
          </span>
        </template>
      </el-dialog>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useSpaceStore } from '@/store/modules/space'
import { createSpace, deleteSpace } from '@/api/space'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  OfficeBuilding, 
  CaretBottom, 
  Setting, 
  Delete, 
  Plus, 
  Search,
  Check
} from '@element-plus/icons-vue'

const spaceStore = useSpaceStore()
const dialogVisible = ref(false)
const showCreateForm = ref(false)
const loading = ref(false)
const searchKeyword = ref('')
const formRef = ref()

const form = reactive({
  name: '',
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入空间名称', trigger: 'blur' }]
}

const currentSpaceName = computed(() => {
  return spaceStore.currentSpace?.name || '选择空间'
})

// 过滤后的空间列表（用于搜索）
const filteredSpaces = computed(() => {
  if (!searchKeyword.value) return spaceStore.spaces
  return spaceStore.spaces.filter((s: any) => 
    s.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

onMounted(() => {
  spaceStore.loadSpaces()
})

const handleCommand = (command: string) => {
  if (command === 'manage') {
    dialogVisible.value = true
    searchKeyword.value = '' // 打开时重置搜索
  } else {
    handleSwitch(command)
  }
}

const handleSwitch = (id: string) => {
  if (id === spaceStore.currentSpaceId) return
  
  ElMessageBox.confirm('切换业务空间将重新加载页面，是否继续？', '切换确认', {
    confirmButtonText: '立即切换',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    spaceStore.setSpace(id)
    window.location.reload()
  })
}

const submitCreate = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true
      try {
        await createSpace(form)
        ElMessage.success('创建成功')
        showCreateForm.value = false
        form.name = ''
        form.description = ''
        await spaceStore.loadSpaces()
      } catch (e) {
        console.error(e)
      } finally {
        loading.value = false
      }
    }
  })
}

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`确定要删除空间 "${row.name}" 吗？此操作不可恢复。`, '删除警告', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'error'
  }).then(async () => {
    try {
      await deleteSpace(row.id)
      ElMessage.success('删除成功')
      await spaceStore.loadSpaces()
    } catch (e) {
      console.error(e)
    }
  })
}
</script>

<style scoped lang="scss">
.space-select-container {
  height: 100%;
  display: flex;
  align-items: center;
  
  /* 修复 el-dropdown 在 flex 容器中的对齐问题 */
  :deep(.el-dropdown) {
    height: 100%;
    display: flex;
    align-items: center;
  }
}

.space-select-trigger {
  display: flex;
  align-items: center;
  padding: 0 4px;
  cursor: pointer;
  height: 100%;
  transition: all 0.3s;
  
  &:hover {
    opacity: 0.8;
  }

  .space-icon {
    font-size: 16px;
    margin-right: 6px;
  }

  .space-name {
    font-size: 14px;
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 4px;
    color: #5a5e66;
  }

  .caret-icon {
    font-size: 12px;
    color: #909399;
  }
}

/* 下拉菜单样式 */
.dropdown-header {
  padding: 8px 16px;
  font-size: 12px;
  color: #909399;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 5px;
}

.space-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-width: 150px;
  
  .item-text {
    flex: 1;
    margin-right: 10px;
    font-weight: 500;
  }
  
  .check-icon {
    color: #409EFF;
    font-weight: bold;
  }
}

.is-selected {
  background-color: #ecf5ff;
  color: #409EFF;
}

.manage-action {
  color: #606266;
  font-weight: 500;
  
  &:hover {
    color: #409EFF;
    background-color: #f5f7fa;
  }
}

/* 弹窗样式 */
.manage-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.name-cell {
  display: flex;
  align-items: center;
}

.ml-2 {
  margin-left: 8px;
}

/* 覆盖表格头样式 (可选) */
:deep(.table-header-gray th) {
  background-color: #f5f7fa !important;
  color: #606266;
}
</style>