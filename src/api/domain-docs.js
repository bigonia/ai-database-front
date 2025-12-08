import request from '@/utils/request'

// 获取文档列表
export function fetchList(query) {
  return request({
    url: '/api/domain-docs/list',
    method: 'get',
    params: query
  })
}

// 获取单个文档详情
export function fetchDocument(id) {
  return request({
    url: `/api/domain-docs/${id}`,
    method: 'get'
  })
}

// 删除文档
export function deleteDocument(id) {
  return request({
    url: `/api/domain-docs/${id}`,
    method: 'delete'
  })
}

// 获取支持的业务动作列表 (下拉菜单用)
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

// 创建衍生文档 (Python脚本清洗)
// 后端接收 @RequestBody String script，因此 Content-Type 设为 text/plain
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

// 获取 AI 生成脚本的接口 URL
// 注意：该接口返回流式数据 (Flux<String>)，建议前端使用 fetch + ReadableStream 处理
export const generateScriptAPI = '/api/domain-docs/generate-script'

// 获取文档流式内容的接口 URL
// 注意：该接口返回 NDJSON 流，建议前端使用 fetch + ReadableStream 处理
export function getDocumentStreamUrl(docId) {
  return `/api/domain-docs/${docId}/stream`
}