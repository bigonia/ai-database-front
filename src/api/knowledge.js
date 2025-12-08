import request from '@/utils/request'

// 基础路径，根据您的Controller定义
const BASE_URL = '/api/documents'

/**
 * 获取所有文档列表
 */
export function fetchDocumentList() {
  return request({
    url: `${BASE_URL}/list`,
    method: 'get'
  })
}

/**
 * 搜索知识库
 * @param {Object} data { query: string, topK: number }
 */
export function searchDocuments(data) {
  return request({
    url: `${BASE_URL}/search`,
    method: 'post',
    data
  })
}

/**
 * 获取文档的所有分片
 * @param {String} sourceId
 */
export function fetchDocumentChunks(sourceId) {
  return request({
    url: `${BASE_URL}/${sourceId}`,
    method: 'get'
  })
}

/**
 * 更新分片内容
 * @param {String} chunkId
 * @param {String} content
 */
export function updateChunk(chunkId, content) {
  return request({
    url: `${BASE_URL}/chunks/${chunkId}`,
    method: 'put',
    data: { content }
  })
}

/**
 * 删除文档
 * @param {String} sourceId
 */
export function deleteDocument(sourceId) {
  return request({
    url: `${BASE_URL}/${sourceId}`,
    method: 'delete'
  })
}