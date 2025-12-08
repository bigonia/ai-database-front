<template>
  <div class="app-container">
    <!-- 顶部工具栏 -->
    <div class="filter-container" style="margin-bottom: 20px;">
      <el-button class="filter-item" type="primary" icon="el-icon-refresh" @click="getList">
        刷新列表
      </el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="listLoading"
      :data="list"
      border
      fit
      highlight-current-row
      style="width: 100%;"
    >
      <el-table-column label="ID" prop="id" align="center" width="80">
        <template #default="{row}">
          <span>{{ row.id }}</span>
        </template>
      </el-table-column>

      <el-table-column label="文档名称" min-width="100px">
        <template #default="{row}">
          <span class="link-type" @click="handleViewDetails(row)">{{ row.docName }}</span>
        </template>
      </el-table-column>
      
      <!-- 文档模式 DocMode -->
      <el-table-column label="模式" width="150px" align="center">
        <template #default="{row}">
          <el-tag :type="row.docMode === 'VIRTUAL' ? 'warning' : 'success'" effect="dark" size="small">
            {{ row.docMode || 'MATERIALIZED' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="来源系统" width="120px" align="center">
        <template #default="{row}">
          <el-tag type="info" effect="plain">{{ row.metadata && row.metadata.sourceSystem ? row.metadata.sourceSystem : '-' }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="类型" width="80px" align="center">
        <template #default="{row}">
          <el-tag type="info">{{ row.documentType }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="100">
        <template #default="{row}">
          <el-tag :type="getStatusType(row.status)">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="业务场景" min-width="180px">
        <template #default="{row}">
          <el-tag
            v-for="feature in row.activeFeatures"
            :key="feature"
            type="success"
            size="small"
            style="margin-right: 5px; margin-bottom: 2px;"
          >
            {{ feature }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="更新时间" width="160px" align="center">
        <template #default="{row}">
          <span>{{ formatTime(row.updatedAt) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" align="center" width="300" class-name="small-padding fixed-width">
        <template #default="{row}">
          <el-button type="success" size="small" @click="handleVectorize(row)">
            向量化
          </el-button>
          <el-button type="warning" size="small" @click="handleDerive(row)">
            清洗
          </el-button>
          <el-button type="primary" size="small" @click="handleTriggerAction(row)">
            动作
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 详情弹窗 -->
    <el-dialog title="文档详情" v-model="detailsVisible" width="75%" top="5vh">
      <el-tabs v-if="tempRow" v-model="activeDetailTab">
        <!-- 标签页1：基本信息 -->
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions border :column="2">
            <el-descriptions-item label="ID">{{ tempRow.id }}</el-descriptions-item>
            <el-descriptions-item label="文档名称">{{ tempRow.docName }}</el-descriptions-item>
            <el-descriptions-item label="模式 (Mode)">{{ tempRow.docMode || 'MATERIALIZED' }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ tempRow.documentType }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(tempRow.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(tempRow.updatedAt) }}</el-descriptions-item>
          </el-descriptions>
          <div class="json-box" style="margin-top: 20px;">
            <h4>元数据 (Metadata)</h4>
            <pre class="json-viewer">{{ tempRow.metadata ? JSON.stringify(tempRow.metadata, null, 2) : '{}' }}</pre>
          </div>
        </el-tab-pane>

        <!-- 标签页2：内容预览 -->
        <el-tab-pane label="内容预览 (Chunks)" name="content">
           <div class="alert-info" v-if="tempRow.docMode === 'VIRTUAL'">
             <i class="el-icon-info"></i> 当前为虚拟文档，此处仅展示部分预览数据。如需查看完整数据，请切换至“实时流预览”标签页。
           </div>
          <div v-if="tempRow.contentList && tempRow.contentList.length > 0">
            <div class="content-summary">
              预览片段数: <span style="font-weight: bold;">{{ tempRow.contentList.length }}</span>
            </div>
            <div class="chunk-list">
              <div 
                v-for="(chunk, index) in tempRow.contentList" 
                :key="chunk.id || index"
                class="chunk-item"
              >
                <div class="chunk-header">
                  <span class="chunk-index">#{{ index + 1 }}</span>
                  <div class="chunk-tools">
                    <el-button type="text" size="small" @click="toggleChunkMeta(chunk)">
                      {{ chunk._showMeta ? '收起元数据' : '查看元数据' }}
                    </el-button>
                    <span class="chunk-id">ID: {{ chunk.id }}</span>
                  </div>
                </div>
                <div v-if="chunk._showMeta" class="chunk-meta-box">
                  <pre>{{ chunk.metadata ? JSON.stringify(chunk.metadata, null, 2) : '{}' }}</pre>
                </div>
                <div class="chunk-text">{{ chunk.text }}</div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无预览数据"></el-empty>
        </el-tab-pane>

        <!-- 标签页3：实时流预览 -->
        <el-tab-pane label="实时流预览 (Live Stream)" name="stream" v-if="tempRow.docMode === 'VIRTUAL'">
          <div class="stream-container">
            <div class="stream-toolbar">
              <el-button type="primary" size="small" @click="handleConnectStream" :loading="isStreaming" :disabled="isStreaming">
                {{ isStreaming ? '接收数据中...' : '连接数据流' }}
              </el-button>
              <el-button size="small" @click="handleClearStream">清空控制台</el-button>
            </div>
            <div class="console-box" ref="consoleBox">
              <div v-for="(line, idx) in streamLogs" :key="idx" class="console-line">
                <span class="line-num">{{ idx + 1 }}</span>
                <span class="line-content">{{ line }}</span>
              </div>
              <div v-if="isStreaming" class="console-cursor">_</div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailsVisible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 衍生文档/数据清洗弹窗 -->
    <el-dialog title="数据清洗与衍生 (Data Cleaning)" v-model="deriveDialogVisible" width="85%" top="5vh">
      <el-row :gutter="20" style="height: 600px;">
        <!-- 左侧：采样数据与AI -->
        <el-col :span="9" style="height: 100%; display: flex; flex-direction: column;">
          
          <!-- 采样数据展示区 (新增) -->
          <div class="panel-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0; margin-bottom: 10px;">
             <div class="panel-title">原始数据采样 (Sample Data)</div>
             <div class="sample-box">
                <pre v-if="sampleDataPreview">{{ sampleDataPreview }}</pre>
                <div v-else class="empty-sample">暂无采样数据</div>
             </div>
          </div>

          <!-- AI 助手区 -->
          <div class="panel-section" style="flex: 0 0 auto;">
            <div class="panel-title">AI 智能助手</div>
            <el-input 
              v-model="deriveTemp.requirement" 
              type="textarea" 
              :rows="4" 
              placeholder="描述清洗需求，例如：&#10;1. 去除所有空行&#10;2. 将手机号替换为 ***&#10;3. 提取 JSON 中的 'price' 字段"
            ></el-input>
            <div style="margin-top: 10px;">
              <el-checkbox v-model="deriveTemp.useSample">将上述采样数据提供给 AI</el-checkbox>
            </div>
            <div style="margin-top: 15px;">
              <el-button type="primary" style="width: 100%;" @click="handleAiGenerate" :loading="aiGenerating">
                {{ aiGenerating ? 'AI 正在编写代码...' : '✨ 生成 Python 脚本' }}
              </el-button>
            </div>
          </div>
        </el-col>

        <!-- 右侧：代码编辑 -->
        <el-col :span="15" style="height: 100%; display: flex; flex-direction: column;">
          <div class="panel-title">Python 清洗脚本</div>
          <el-input
            v-model="deriveTemp.script"
            type="textarea"
            class="code-editor"
            placeholder="# 在此处编写或生成 Python 清洗逻辑..."
          ></el-input>
        </el-col>
      </el-row>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deriveDialogVisible = false">取 消</el-button>
          <el-button type="success" @click="submitDerive" :loading="deriveLoading">执行清洗并创建文档</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 业务动作弹窗 -->
    <el-dialog :title="'执行业务动作 - ' + (actionTemp.docName || '')" v-model="actionDialogVisible">
      <el-form ref="actionForm" :model="actionTemp" label-position="left" label-width="100px" style="width: 400px; margin-left:50px;">
        <el-form-item label="选择动作" prop="action" :rules="{ required: true, message: '请选择动作', trigger: 'change' }">
          <el-select v-model="actionTemp.action" placeholder="请选择业务动作" style="width: 100%" @change="handleActionSelectChange">
            <el-option
              v-for="(label, value) in supportedActions"
              :key="value"
              :label="label + ' (' + value + ')'"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="参数配置">
          <el-input
            v-model="actionTemp.paramsJson"
            type="textarea"
            :rows="4"
            placeholder='请输入JSON格式参数'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="actionDialogVisible = false">取 消</el-button>
          <el-button type="primary" :loading="actionLoading" @click="submitAction">确 认</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { 
  fetchList, fetchDocument, deleteDocument, fetchSupportedActions, triggerBusinessAction, vectorDocument,
  createDerivedDocument, generateScriptAPI, getDocumentStreamUrl
} from '@/api/domain-docs'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getToken } from '@/utils/auth'
import { useSpaceStore } from '@/store/modules/space';

export default {
  name: 'DomainDocList',
  data() {
    return {
      list: [],
      listLoading: true,
      supportedActions: {},
      
      // 详情弹窗
      detailsVisible: false,
      activeDetailTab: 'info',
      tempRow: null,
      
      // 流式查看
      isStreaming: false,
      streamLogs: [],

      // 动作弹窗
      actionDialogVisible: false,
      actionLoading: false,
      actionTemp: { id: undefined, docName: '', action: '', paramsJson: '{}' },

      // 衍生/清洗弹窗
      deriveDialogVisible: false,
      deriveLoading: false,
      aiGenerating: false,
      sampleDataPreview: '', // 新增：采样数据预览文本
      deriveTemp: {
        parentId: null,
        requirement: '',
        useSample: true,
        script: ''
      }
    }
  },
  created() {
    this.getList()
    this.getActions()
  },
  methods: {
    // 兼容获取 Base URL，修复 process is not defined
    getBaseUrl() {
      // Vite 环境使用 import.meta.env
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_APP_BASE_API || ''
      }
      // Webpack 环境使用 process.env (需判断 process 是否存在)
      if (typeof process !== 'undefined' && process.env) {
        return process.env.VUE_APP_BASE_API || ''
      }
      return '' // 默认空字符串（相对路径）
    },

    getStatusType(status) {
      const statusMap = {
        COMPLETED: 'success',
        PROCESSING: 'warning',
        FAILED: 'danger',
        PENDING: 'info',
        CREATED: 'info'
      }
      return statusMap[status] || 'info'
    },
    
    formatTime(timeStr) {
      if (!timeStr) return ''
      try {
        const date = new Date(timeStr)
        if (isNaN(date.getTime())) return timeStr 
        const y = date.getFullYear()
        const m = (date.getMonth() + 1).toString().padStart(2, '0')
        const d = date.getDate().toString().padStart(2, '0')
        const h = date.getHours().toString().padStart(2, '0')
        const i = date.getMinutes().toString().padStart(2, '0')
        return `${y}-${m}-${d} ${h}:${i}`
      } catch (e) {
        return timeStr
      }
    },

    async getList() {
      this.listLoading = true
      try {
        const response = await fetchList()
        this.list = response.data || [] 
      } catch (error) {
        console.error(error)
      } finally {
        this.listLoading = false
      }
    },

    async getActions() {
      try {
        const response = await fetchSupportedActions()
        this.supportedActions = response.data || {}
      } catch (error) { console.error(error) }
    },

    // --- 详情与流式查看 ---
    handleViewDetails(row) {
      this.tempRow = JSON.parse(JSON.stringify(row))
      if (this.tempRow.contentList) {
        this.tempRow.contentList.forEach(chunk => chunk._showMeta = false)
      }
      this.activeDetailTab = 'info'
      this.detailsVisible = true
      this.streamLogs = []
      this.isStreaming = false
    },

    toggleChunkMeta(chunk) {
      chunk._showMeta = !chunk._showMeta
    },

    handleClearStream() {
      this.streamLogs = []
    },

    async handleConnectStream() {
      if (!this.tempRow || !this.tempRow.id) return
      this.isStreaming = true
      this.streamLogs = []
      
      const url = getDocumentStreamUrl(this.tempRow.id)
      
      try {
        const token = getToken()
        // 修复：使用 getBaseUrl() 替代直接访问 process
        const baseUrl = this.getBaseUrl()
        const fullUrl = baseUrl + url
        // 注入业务空间 ID
        const spaceStore = useSpaceStore();

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Space-Id': spaceStore.currentSpaceId,
            'Accept': 'application/x-ndjson'
          }
        })


        if (!response.ok) throw new Error('Network response was not ok')
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line)
                this.streamLogs.push(JSON.stringify(json))
              } catch (e) {
                this.streamLogs.push(line)
              }
              this.$nextTick(() => {
                const box = this.$refs.consoleBox
                if (box) box.scrollTop = box.scrollHeight
              })
            }
          }
        }
      } catch (e) {
        ElMessage.error('数据流连接中断或失败: ' + e.message)
        console.error(e)
      } finally {
        this.isStreaming = false
      }
    },

    // --- 衍生文档 / 清洗 ---
    async handleDerive(row) {
      this.deriveTemp = {
        parentId: row.id,
        requirement: '',
        useSample: true,
        script: '# Python Script for Document Cleaning\n\ndef process(doc):\n    # doc 是一个字典，包含 content, metadata 等\n    # TODO: Implement your logic here\n    return doc\n'
      }
      this.sampleDataPreview = '加载中...'
      this.deriveDialogVisible = true

      // 获取采样数据逻辑
      try {
        let contentList = row.contentList
        // 如果列表中没有 contentList，则尝试获取详情
        if (!contentList || contentList.length === 0) {
           const res = await fetchDocument(row.id)
           if (res.data && res.data.contentList) {
             contentList = res.data.contentList
           }
        }

        if (contentList && contentList.length > 0) {
          // 取前3条作为采样
          const samples = contentList.slice(0, 3).map(c => ({
            id: c.id,
            text: c.text,
            metadata: c.metadata
          }))
          this.sampleDataPreview = JSON.stringify(samples, null, 2)
        } else {
          this.sampleDataPreview = '该文档暂无内容数据'
        }
      } catch (e) {
        this.sampleDataPreview = '无法加载采样数据: ' + e.message
      }
    },

    async handleAiGenerate() {
      if (!this.deriveTemp.requirement) {
        ElMessage.warning('请输入清洗需求')
        return
      }
      
      this.aiGenerating = true
      this.deriveTemp.script = ''

      try {
        const token = getToken()
        const requestBody = {
          docId: this.deriveTemp.parentId,
          // 如果勾选了使用采样，则将前端展示的采样文本传给后端（如果后端需要），或者后端自己根据 docId 查
          // 这里假设后端主要依赖 docId，前端采样数据作为补充 prompt
          sampleData: this.deriveTemp.useSample ? this.sampleDataPreview : null, 
          requirement: this.deriveTemp.requirement
        }

        // 修复：使用 getBaseUrl() 替代直接访问 process
        const baseUrl = this.getBaseUrl()
        const fullUrl = baseUrl + generateScriptAPI

        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) throw new Error('AI Service Error: ' + response.statusText)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          this.deriveTemp.script += chunk
        }

      } catch (e) {
        ElMessage.error('AI 生成失败: ' + e.message)
        console.error(e)
      } finally {
        this.aiGenerating = false
      }
    },

    async submitDerive() {
      if (!this.deriveTemp.script) return
      this.deriveLoading = true
      try {
        await createDerivedDocument(this.deriveTemp.parentId, this.deriveTemp.script)
        ElMessage.success('衍生文档创建任务已提交')
        this.deriveDialogVisible = false
        this.getList()
      } catch (e) {
        console.error(e)
      } finally {
        this.deriveLoading = false
      }
    },

    // --- 通用动作 ---
    handleVectorize(row) {
      ElMessageBox.confirm(`确认对文档 "${row.docName}" 进行向量化处理吗?`, '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'info'
      }).then(async () => {
        try {
          await vectorDocument(row.id)
          ElMessage.success('向量化任务触发成功')
          this.getList()
        } catch (e) { console.error(e) }
      }).catch(() => {})
    },
    
    handleDelete(row) {
      ElMessageBox.confirm(`确认删除文档 "${row.docName}" 吗?`, '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
      }).then(async () => {
        await deleteDocument(row.id)
        ElMessage.success('删除成功!')
        this.getList()
      }).catch(() => {})
    },

    handleTriggerAction(row) {
      this.actionTemp = { id: row.id, docName: row.docName, action: '', paramsJson: '{}' }
      this.actionDialogVisible = true
      this.$nextTick(() => { if(this.$refs['actionForm']) this.$refs['actionForm'].clearValidate() })
    },

    handleActionSelectChange(val) {
      if (val === 'VECTORIZED') this.actionTemp.paramsJson = '{\n  "chunkSize": 500\n}'
      else if (val === 'GEN_QA') this.actionTemp.paramsJson = '{\n  "count": 3\n}'
      else this.actionTemp.paramsJson = '{}'
    },

    submitAction() {
      this.$refs['actionForm'].validate(async (valid) => {
        if (valid) {
          let params = {}
          try {
            if (this.actionTemp.paramsJson && this.actionTemp.paramsJson.trim() !== '') {
              params = JSON.parse(this.actionTemp.paramsJson)
            }
          } catch (e) {
            ElMessage.error('参数格式错误：必须是合法的 JSON 格式')
            return
          }
          this.actionLoading = true
          try {
            await triggerBusinessAction(this.actionTemp.id, { action: this.actionTemp.action, params: params })
            ElMessage.success('业务动作触发成功')
            this.actionDialogVisible = false
            this.getList()
          } catch (error) { console.error(error) } finally { this.actionLoading = false }
        }
      })
    }
  }
}
</script>

<style scoped>
.link-type { color: #409EFF; cursor: pointer; }
.link-type:hover { text-decoration: underline; }
.json-viewer { background-color: #f4f4f5; padding: 10px; border-radius: 4px; font-family: Consolas, monospace; font-size: 12px; max-height: 300px; overflow: auto; }
.content-summary { margin-bottom: 10px; font-size: 14px; color: #606266; }
.chunk-list { max-height: 500px; overflow-y: auto; border: 1px solid #ebeef5; border-radius: 4px; background: #f9fafe; padding: 10px; }
.chunk-item { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0, 0, 0, .05); }
.chunk-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ebeef5; font-size: 12px; color: #909399; }
.chunk-index { font-weight: bold; color: #409EFF; }
.chunk-tools { display: flex; align-items: center; }
.chunk-id { margin-left: 10px; color: #C0C4CC; }
.chunk-meta-box { background-color: #f0f2f5; padding: 8px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid #909399; }
.chunk-meta-box pre { margin: 0; white-space: pre-wrap; font-family: Consolas, monospace; font-size: 12px; color: #606266; }
.chunk-text { font-size: 14px; line-height: 1.6; color: #303133; white-space: pre-wrap; }

/* 衍生弹窗样式 - 增强布局 */
.panel-title { font-weight: bold; margin-bottom: 10px; color: #303133; font-size: 14px; border-left: 4px solid #409EFF; padding-left: 8px; }
.sample-box { flex: 1; background: #282c34; border-radius: 4px; padding: 10px; overflow: auto; color: #abb2bf; font-family: Consolas, monospace; font-size: 12px; border: 1px solid #dcdfe6; }
.sample-box pre { margin: 0; white-space: pre-wrap; }
.empty-sample { color: #606266; text-align: center; margin-top: 20px; font-style: italic; }

.code-editor >>> .el-textarea__inner { font-family: 'Consolas', 'Courier New', monospace; background-color: #282c34; color: #abb2bf; line-height: 1.5; min-height: 550px !important; }

/* 流式控制台样式 */
.stream-container { height: 500px; display: flex; flex-direction: column; }
.stream-toolbar { margin-bottom: 10px; }
.console-box { flex: 1; background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-y: auto; font-family: Consolas, monospace; border-radius: 4px; font-size: 13px; }
.console-line { margin-bottom: 4px; display: flex; }
.line-num { color: #858585; margin-right: 15px; min-width: 30px; text-align: right; user-select: none; }
.line-content { white-space: pre-wrap; word-break: break-all; }
.console-cursor { display: inline-block; width: 8px; height: 15px; background: #d4d4d4; animation: blink 1s step-end infinite; }
.alert-info { background-color: #e6f7ff; border: 1px solid #91d5ff; padding: 8px 15px; border-radius: 4px; margin-bottom: 15px; color: #000000d9; font-size: 13px; }

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>