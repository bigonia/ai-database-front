<template>
  <div class="app-container">
    <!-- 顶部操作栏 -->
    <div class="filter-container">
      <el-input 
        v-model="listQuery.originalFilename" 
        placeholder="文件名" 
        style="width: 200px; margin-right: 10px;" 
        class="filter-item" 
        @keyup.enter="handleFilter"
      />
      <el-input 
        v-model="uploadData.sourceSystem" 
        placeholder="来源系统" 
        style="width: 200px; margin-right: 10px;" 
        class="filter-item" 
      />
      <!-- 使用 http-request 实现自定义上传 -->
      <el-upload
        class="upload-demo filter-item"
        action=""
        :http-request="customUpload"
        :show-file-list="false"
        multiple
      >
        <el-button type="primary">点击上传</el-button>
      </el-upload>
      
      <el-button class="filter-item" type="primary" icon="Search" @click="fetchData">
        搜索
      </el-button>
    </div>

    <!-- 文件列表 -->
    <el-table
      :key="tableKey"
      :data="list"
      border
      highlight-current-row
      style="width: 100%; margin-top: 20px;"
      v-loading="listLoading"
    >
      <el-table-column label="ID" prop="id" align="center" width="80px">
        <template #default="{ row }">
          <span>{{ row.id }}</span>
        </template>
      </el-table-column>
      
      <el-table-column label="文件名" min-width="250px">
        <template #default="{ row }">
          <!-- 点击文件名也可以预览 -->
          <span 
            class="link-type" 
            style="color: #409EFF; cursor: pointer; text-decoration: underline;" 
            @click="handleFilePreview(row)"
          >
            {{ row.originalFilename }}
          </span>
          <br>
          <span style="font-size: 12px; color: #909399;">
             存储名: {{ row.storedFilename }}
          </span>
        </template>
      </el-table-column>
      
      <el-table-column label="来源系统" width="150px" align="center">
        <template #default="{ row }">
          <el-tag effect="plain" type="info">{{ row.sourceSystem || 'Unknown' }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="上传时间" width="180px" align="center">
        <template #default="{ row }">
          <span>{{ formatDateTime(row.createdAt) }}</span>
        </template>
      </el-table-column>
      
      <!-- 已移除处理状态列 -->
      
      <el-table-column label="操作" align="center" width="200px" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleFilePreview(row)">
            预览
          </el-button>
          
          <el-button link type="primary" size="small" @click="handleFileToDoc(row)">
            转文档
          </el-button>

          <el-button link type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页组件 (根据你的 Pagination 组件版本，可能需要调整 :page.sync 为 v-model:page) -->
    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="listQuery.page"
      :limit.sync="listQuery.limit"
      @pagination="fetchData"
    />

    <!-- 预览弹窗 -->
    <!-- 注意：Element Plus 使用 v-model 控制显示，而不是 :visible.sync -->
    <el-dialog 
      :title="previewTitle" 
      v-model="dialogFilePreviewVisible" 
      width="80%" 
      :close-on-click-modal="false"
      destroy-on-close
      top="5vh"
    >
      <div v-loading="filePreviewLoading" :style="{ height: previewHeight, overflow: 'auto' }">
        
        <!-- 文本/代码预览 -->
        <pre v-if="previewType === 'text'" style="white-space: pre-wrap; font-family: Consolas, monospace;">{{ textContent }}</pre>
        
        <!-- 图片预览 -->
        <div v-else-if="previewType === 'image'" style="text-align: center;">
             <img :src="filePreviewUrl" style="max-width: 100%; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);" />
        </div>
       
        <!-- PDF预览 -->
        <iframe v-else-if="previewType === 'pdf'" :src="filePreviewUrl" width="100%" height="100%" frameborder="0"></iframe>
        
        <!-- Excel预览 -->
        <div v-else-if="previewType === 'excel'" v-html="excelHtml" class="excel-preview"></div>
        
        <!-- Word预览容器 -->
        <div v-else-if="previewType === 'word'" ref="docxContainer"></div>
        
        <!-- 不支持类型 -->
        <div v-else-if="previewType === 'unsupported'" class="empty-container">
          <p>当前文件格式不支持在线预览</p>
          <el-button type="primary" @click="downloadFile(currentFileId, currentFileName)">下载文件</el-button>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<script>
// 移除了 vectorizeFile, deleteFileVectors 引用
import { getFileList, deleteFile, fileToDoc, getFileContent, uploadFile } from '@/api/file'
import Pagination from '@/components/Pagination'
import { ElMessage, ElMessageBox } from 'element-plus'
import { renderAsync } from 'docx-preview' 
import * as XLSX from 'xlsx' 

export default {
  name: 'FileManager',
  components: { Pagination },
  data() {
    return {
      tableKey: 0,
      list: [],
      total: 0,
      listLoading: true,
      listQuery: {
        page: 1,
        limit: 20,
        originalFilename: undefined 
      },
      uploadData: {
        sourceSystem: 'Manually'
      },
      
      // *** 修复关键：在 data 中声明预览相关的变量 ***
      dialogFilePreviewVisible: false, // 控制弹窗显示
      filePreviewLoading: false,       // 控制加载遮罩
      previewTitle: '文件预览',
      previewHeight: '75vh',
      previewType: '',                 // pdf, image, text, word, excel
      textContent: '',
      excelHtml: '',
      filePreviewUrl: '',
      currentFileName: '',
      currentFileId: null
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    formatDateTime(isoString) {
      if (!isoString) return '--'
      const date = new Date(isoString)
      return date.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    },

    fetchData() {
      this.listLoading = true
      getFileList(this.listQuery).then(response => {
        // 适配列表数据
        const items = response.data || response.items || []
        this.list = items
        this.total = response.total || items.length
      }).finally(() => {
        this.listLoading = false
      })
    },

    handleFilter() {
      this.listQuery.page = 1
      this.fetchData()
    },

    // 自定义上传逻辑
    customUpload(param) {
      const formData = new FormData()
      formData.append('file', param.file)
      // 如果后端需要 sourceSystem，可以在这里带上
      uploadFile(formData, this.uploadData.sourceSystem).then(() => {
        ElMessage.success(`${param.file.name} 上传成功`)
        this.fetchData()
      }).catch(() => {
        ElMessage.error('上传失败')
      })
    },

    // 预览逻辑
    async handleFilePreview(row) {
      // 1. 先显示弹窗和Loading
      this.dialogFilePreviewVisible = true
      this.filePreviewLoading = true
      
      this.currentFileName = row.originalFilename
      this.currentFileId = row.id
      this.previewTitle = `预览: ${row.originalFilename}`
      
      // 重置状态
      if (this.filePreviewUrl) URL.revokeObjectURL(this.filePreviewUrl)
      this.filePreviewUrl = ''
      this.textContent = ''
      this.excelHtml = ''
      this.previewType = ''
      
      // 获取扩展名
      const ext = row.originalFilename.substring(row.originalFilename.lastIndexOf('.') + 1).toLowerCase()
      
      try {
        // 调用API获取 Blob
        const blob = await getFileContent(row.id)
        
        // 简单判断是否为 JSON 错误信息
        if (blob.type === 'application/json') {
           throw new Error('无法获取文件内容')
        }

        this.previewType = this.detectFileType(ext)

        if (this.previewType === 'text') {
          this.textContent = await blob.text()
        } 
        else if (this.previewType === 'word') {
          this.$nextTick(() => {
             // 确保 ref 存在
             if(this.$refs.docxContainer) {
                 renderAsync(blob, this.$refs.docxContainer).catch(err => console.error(err))
             }
          })
        }
        else if (this.previewType === 'excel') {
          const arrayBuffer = await blob.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          this.excelHtml = XLSX.utils.sheet_to_html(worksheet)
        }
        else if (['pdf', 'image', 'video', 'audio'].includes(this.previewType)) {
          let mimeType = blob.type
          if (this.previewType === 'pdf') mimeType = 'application/pdf' // 强制修正PDF类型
          const newBlob = new Blob([blob], { type: mimeType })
          this.filePreviewUrl = URL.createObjectURL(newBlob)
        }

      } catch (err) {
        console.error(err)
        ElMessage.error('预览失败: ' + (err.message || '未知错误'))
        this.previewType = 'unsupported'
      } finally {
        this.filePreviewLoading = false
      }
    },

    detectFileType(ext) {
      const typeMap = {
        pdf: ['pdf'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
        text: ['txt', 'json', 'xml', 'md', 'log', 'java', 'py', 'sql', 'js', 'css', 'html'],
        word: ['docx'],
        excel: ['xlsx', 'xls', 'csv'],
        video: ['mp4', 'webm'],
        audio: ['mp3', 'wav']
      }
      for (const [type, exts] of Object.entries(typeMap)) {
        if (exts.includes(ext)) return type
      }
      return 'unsupported'
    },
    
    async downloadFile(id, filename) {
      try {
        const blob = await getFileContent(id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        ElMessage.error('下载失败');
      }
    },
    
    handleFileToDoc(row) {
        ElMessageBox.confirm(`确定要将 "${row.originalFilename}" 转换为文档吗？`, '提示', {
            type: 'info'
        }).then(() => {
            fileToDoc(row.id).then(() => {
                ElMessage.success('转换任务已提交')
            })
        })
    },

    handleDelete(row) {
      ElMessageBox.confirm('确认永久删除文件?', '警告', { type: 'error' })
        .then(() => deleteFile(row.id))
        .then(() => {
          ElMessage.success('删除成功')
          this.fetchData()
        })
    }
  }
}
</script>

<style scoped>
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
  color: #909399;
}
.excel-preview ::v-deep table {
  border-collapse: collapse;
  width: 100%;
}
.excel-preview ::v-deep td, .excel-preview ::v-deep th {
  border: 1px solid #dfe6ec;
  padding: 8px;
}
</style>