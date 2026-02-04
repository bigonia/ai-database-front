import request from '@/utils/request'

// 获取文档列表
export function fetchList(query) {
  return request({
    url: '/api/domain-docs/list',
    method: 'get',
    params: query
  })
}

// 获取单个文档详情 (基本信息)
export function fetchDocument(id) {
  return request({
    url: `/api/domain-docs/${id}`,
    method: 'get'
  })
}

// 新增：分页获取文档内容片段 (Context)
export function fetchDocumentContext(id, params) {
  return request({
    url: `/api/domain-docs/${id}/context`,
    method: 'get',
    params // { page, size }
  })
}

// 删除文档
export function deleteDocument(id) {
  return request({
    url: `/api/domain-docs/${id}`,
    method: 'delete'
  })
}

// 获取支持的业务动作列表
export function fetchSupportedActions() {
  return request({
    url: '/api/domain-docs/actions/support-list',
    method: 'get'
  })
}

// 触发业务动作
export function triggerBusinessAction(id, data) {
  return request({
    url: `/api/domain-docs/${id}/actions`,
    method: 'post',
    data
  })
}

// 触发文档向量化
export function vectorDocument(id) {
  return request({
    url: `/api/domain-docs/vector/${id}`,
    method: 'get'
  })
}

// 创建衍生文档
export function createDerivedDocument(parentId, script) {
  return request({
    url: `/api/domain-docs/${parentId}/derive`,
    method: 'post',
    data: script,
    headers: {
      'Content-Type': 'text/plain'
    }
  })
}

// 导出文档为Excel
export function exportDocumentExcel(docId) {
  return request({
    url: `/api/domain-docs/${docId}/export/excel`,
    method: 'get',
    responseType: 'blob', // 必须设置为 blob
    timeout: 60000 // 增加超时时间应对大文件
  })
}

export const generateScriptAPI = '/api/domain-docs/generate-script'

export function getDocumentStreamUrl(docId) {
  return `/api/domain-docs/${docId}/stream`
}