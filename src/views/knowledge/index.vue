<template>
  <div class="app-container">
    <!-- 顶部工具栏：语义搜索测试 (优化版) -->
    <el-card class="search-card" shadow="hover">
      <div class="search-container">
        <!-- 标题区 -->
        <div class="search-header">
          <span class="title"><i class="el-icon-search" /> 语义检索实验室</span>
          <span class="subtitle">输入自然语言问题，测试知识库的向量召回效果</span>
        </div>

        <!-- 核心搜索区 -->
        <div class="search-main">
          <el-input
            v-model="searchQuery.query"
            placeholder="在此输入您的问题，例如：'如何申请数据接入？' (回车搜索)"
            class="big-search-input"
            @keyup.enter="handleSearch"
            clearable
          >
            <template #prefix>
              <i class="el-icon-search input-icon-large" style="line-height: 50px; margin-left: 5px;" />
            </template>
          </el-input>
          <el-button 
            type="primary" 
            class="search-btn-large" 
            :loading="searchLoading"
            @click="handleSearch"
          >
            开始搜索
          </el-button>
        </div>

        <!-- 参数控制栏 -->
        <div class="search-params-bar">
          <div class="param-group">
            <span class="param-label"><i class="el-icon-setting" /> 召回数量 (TopK):</span>
            <el-input-number
              v-model="searchQuery.topK"
              :min="1"
              :max="20"
              controls-position="right"
              size="small"
              class="param-input"
            />
            
            <el-divider direction="vertical" />

            <span class="param-label">相似度阈值 (Threshold):</span>
            <el-input-number
              v-model="searchQuery.threshold"
              :min="0"
              :max="1"
              :step="0.1"
              :precision="2"
              controls-position="right"
              size="small"
              class="param-input"
            />
          </div>

          <div class="action-group">
             <el-button
              type="text"
              icon="el-icon-refresh"
              class="refresh-btn"
              @click="getList"
            >
              刷新文档列表
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 主表格：文档列表 -->
    <!-- Vue 3 修改点：移除 .native 修饰符，slot-scope 改为 #default -->
    <el-table
      v-loading="listLoading"
      :data="list"
      border
      fit
      highlight-current-row
      style="width: 100%; margin-top: 20px;"
      class="document-table"
    >
      <el-table-column label="ID" prop="sourceId" width="280" align="center">
        <template #default="{ row }">
          <span v-if="row.sourceId" class="link-type" @click="handleViewChunks(row)">
            {{ row.sourceId }}
          </span>
          <span v-else style="color: #909399; font-style: italic;">无ID</span>
        </template>
      </el-table-column>

      <el-table-column label="文档名称" prop="sourceName" min-width="200px">
        <template #default="{ row }">
          <span style="font-weight: 500">{{ row.sourceName || '未命名文档' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="来源系统" prop="sourceSystem" width="150" align="center">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.sourceSystem || 'Unknown' }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="类型" prop="documentType" width="120" align="center" />

      <el-table-column label="分片数量" prop="chunkCount" width="100" align="center">
        <template #default="{ row }">
          <el-tag type="info">{{ row.chunkCount || 0 }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="操作" align="center" width="200" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            size="small" 
            :disabled="!row.sourceId"
            @click="handleViewChunks(row)"
          >
            分片管理
          </el-button>
          <el-popconfirm
            title="确定要删除该文档及其所有向量分片吗？"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button 
                size="small" 
                type="danger" 
                style="margin-left: 10px;"
                :disabled="!row.sourceId"
              >
                删除
              </el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 优化后的语义搜索结果对话框 -->
    <!-- Vue 3 修改点：:visible.sync 改为 v-model -->
    <el-dialog 
      title="语义搜索结果" 
      v-model="searchDialogVisible" 
      width="70%"
      custom-class="search-result-dialog"
    >
      <div v-loading="searchLoading" class="search-result-container">
        <div v-if="searchResults.length === 0" class="empty-result">
          <i class="el-icon-document-remove"></i> 暂无匹配结果
        </div>
        
        <div 
          v-for="(item, index) in searchResults" 
          :key="index" 
          class="search-item-card"
        >
          <div class="search-item-header">
            <el-tag size="small" effect="dark" type="success">Top {{ index + 1 }}</el-tag>
            <span class="search-score" v-if="item.score">相似度: {{ item.score.toFixed(4) }}</span>
          </div>
          
          <div class="search-item-content">
            <!-- 修复点：content 改为 text -->
            {{ item.text }}
          </div>
          
          <div class="search-item-meta" v-if="item.metadata && Object.keys(item.metadata).length > 0">
            <div class="meta-title">元数据信息:</div>
            <div class="meta-tags">
              <el-tag 
                v-for="(val, key) in item.metadata" 
                :key="key" 
                size="small" 
                type="info"
                class="meta-tag"
              >
                {{ key }}: {{ val }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="searchDialogVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- 分片管理抽屉 -->
    <!-- Vue 3 修改点：:visible.sync 改为 v-model -->
    <el-drawer
      :title="`文档分片: ${currentDocName}`"
      v-model="drawerVisible"
      size="50%"
      direction="rtl"
      :before-close="handleDrawerClose"
    >
      <div class="drawer-container" v-loading="chunksLoading">
        <div v-if="chunksList.length === 0" class="empty-text">暂无分片数据</div>

        <el-card
          v-for="(chunk, index) in chunksList"
          :key="chunk.id"
          class="chunk-card"
          shadow="hover"
        >
          <template #header>
            <div class="clearfix">
              <span>分片 #{{ index + 1 }}</span>
              <span style="float: right; color: #909399; font-size: 12px">ID: {{ chunk.id }}</span>
            </div>
          </template>

          <!-- 编辑模式 -->
          <div v-if="chunk.isEditing">
            <el-input
              type="textarea"
              :rows="6"
              v-model="chunk.tempContent"
              placeholder="请输入分片内容"
            />
            <div style="margin-top: 10px; text-align: right;">
              <el-button size="small" @click="cancelEditChunk(chunk)">取消</el-button>
              <el-button type="success" size="small" @click="submitChunkEdit(chunk)">保存更新</el-button>
            </div>
          </div>

          <!-- 查看模式 -->
          <div v-else>
            <div class="chunk-content">{{ chunk.content }}</div>
            <div class="chunk-meta" v-if="chunk.metadata">
              Metadata: {{ chunk.metadata }}
            </div>
            <div style="margin-top: 10px; text-align: right;">
              <el-button type="primary" link @click="enableEditChunk(chunk)">
                <i class="el-icon-edit"></i> 编辑内容
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </el-drawer>
  </div>
</template>

<script>
// 注意：如果在 Vue 3 + Vite 环境下，Element Icons 可能需要单独导入
// import { Search, Refresh } from '@element-plus/icons-vue' 
import {
  fetchDocumentList,
  searchDocuments,
  deleteDocument,
  fetchDocumentChunks,
  updateChunk
} from '@/api/knowledge'

export default {
  name: 'KnowledgeBase',
  data() {
    return {
      // 列表相关
      list: [],
      listLoading: true,

      // 搜索相关
      searchQuery: {
        query: '',
        topK: 5,
        threshold: 0.4 // 新增阈值参数，默认为 0.0
      },
      searchLoading: false,
      searchResults: [],
      searchDialogVisible: false,

      // 分片抽屉相关
      drawerVisible: false,
      currentDocName: '',
      chunksList: [],
      chunksLoading: false
    }
  },
  created() {
    this.getList()
  },
  methods: {
    // 获取文档列表
    async getList() {
      this.listLoading = true
      try {
        const response = await fetchDocumentList()
        // 增加空值保护，防止 response.data 为 null
        this.list = response.data || []
      } catch (error) {
        console.error(error)
        this.list = []
      } finally {
        this.listLoading = false
      }
    },

    // 搜索
    async handleSearch() {
      if (!this.searchQuery.query.trim()) {
        this.$message.warning('请输入搜索关键词')
        return
      }
      this.searchLoading = true
      this.searchDialogVisible = true
      try {
        const response = await searchDocuments(this.searchQuery)
        this.searchResults = response.data || []
      } catch (error) {
        this.searchResults = []
      } finally {
        this.searchLoading = false
      }
    },

    // 删除文档
    async handleDelete(row) {
      if (!row.sourceId) return
      try {
        await deleteDocument(row.sourceId)
        this.$message.success('删除成功')
        const index = this.list.indexOf(row)
        if (index > -1) {
          this.list.splice(index, 1)
        }
      } catch (error) {
        console.error(error)
      }
    },

    // 查看分片 (打开抽屉)
    async handleViewChunks(row) {
      if (!row.sourceId) {
        this.$message.error('无效的文档ID')
        return
      }
      this.currentDocName = row.sourceName || '未命名文档'
      this.drawerVisible = true
      this.chunksLoading = true
      this.chunksList = []

      try {
        const response = await fetchDocumentChunks(row.sourceId)
        const data = response.data || []
        // 为每个分片添加编辑状态控制字段
        this.chunksList = data.map(item => ({
          ...item,
          isEditing: false,
          tempContent: item.content
        }))
      } catch (error) {
        console.error(error)
      } finally {
        this.chunksLoading = false
      }
    },

    handleDrawerClose(done) {
      done()
    },

    // 开启分片编辑
    enableEditChunk(chunk) {
      chunk.isEditing = true
      chunk.tempContent = chunk.content
    },

    // 取消分片编辑
    cancelEditChunk(chunk) {
      chunk.isEditing = false
    },

    // 提交分片更新
    async submitChunkEdit(chunk) {
      if (!chunk.tempContent.trim()) {
        this.$message.warning('内容不能为空')
        return
      }

      try {
        await updateChunk(chunk.id, chunk.tempContent)
        this.$message.success('更新分片成功，向量已重算')
        chunk.content = chunk.tempContent
        chunk.isEditing = false
      } catch (error) {
        console.error(error)
      }
    }
  }
}
</script>

<style scoped>
/* 搜索板块样式优化 */
.search-card {
  margin-bottom: 25px;
  border-radius: 8px;
  background: linear-gradient(to bottom, #ffffff, #f9fafc);
}

.search-container {
  padding: 5px 10px;
}

.search-header {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.search-header .title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-right: 12px;
}

.search-header .subtitle {
  font-size: 13px;
  color: #909399;
  padding-left: 12px;
  border-left: 2px solid #e4e7ed;
  line-height: 14px;
}

.search-main {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

/* 穿透修改 El-Input 内部样式以增大尺寸 */
.big-search-input :deep(.el-input__inner) {
  height: 50px;
  line-height: 50px;
  font-size: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.search-btn-large {
  height: 50px;
  padding: 0 30px;
  font-size: 16px;
  border-radius: 8px;
}

.search-params-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #f5f7fa;
  padding: 10px 20px;
  border-radius: 6px;
}

.param-group {
  display: flex;
  align-items: center;
  gap: 15px;
}

.param-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.param-input {
  width: 100px;
}

.refresh-btn {
  color: #909399;
  font-weight: normal;
}
.refresh-btn:hover {
  color: #409EFF;
}

.link-type {
  color: #409EFF;
  cursor: pointer;
  font-weight: bold;
}
.link-type:hover {
  text-decoration: underline;
}

/* 搜索结果美化样式 */
.search-result-container {
  max-height: 60vh;
  overflow-y: auto;
  padding: 10px;
}
.search-item-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #EBEEF5;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
  margin-bottom: 20px;
  padding: 20px;
  transition: all 0.3s;
}
.search-item-card:hover {
  box-shadow: 0 4px 16px 0 rgba(0,0,0,0.1);
}
.search-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.search-score {
  font-size: 13px;
  color: #67C23A;
  font-weight: 600;
}
.search-item-content {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  white-space: pre-wrap;
  background: #fcfcfc;
  padding: 10px;
  border-radius: 4px;
}
.search-item-meta {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
}
.meta-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.meta-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-result {
  text-align: center;
  padding: 40px;
  color: #909399;
  font-size: 16px;
}

/* Drawer 样式 */
.drawer-container {
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 80px);
  background-color: #f0f2f5;
}
.chunk-card {
  margin-bottom: 15px;
}
.chunk-content {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e6e6e6;
}
.chunk-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}
.empty-text {
  text-align: center;
  color: #909399;
  margin-top: 50px;
}
</style>