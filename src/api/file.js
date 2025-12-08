import request from '@/utils/request'

/**
 * 获取文件列表
 * @param {object} query - 查询参数
 */
export function getFileList(query) {
  return request({
    url: '/api/files',
    method: 'get',
    params: query
  })
}

/**
 * 上传文件
 * @param {FormData} data 
 * @param {string} sourceSystem 
 */
export function uploadFile(data, sourceSystem) {
  return request({
    url: '/api/files/upload',
    method: 'post',
    params: { sourceSystem },
    data: data,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 删除文件 (物理删除)
 * @param {number} id - 文件ID
 */
export function deleteFile(id) {
  return request({
    url: `/api/files/${id}`,
    method: 'delete'
  })
}

/**
 * 向量化文件
 * @param {number} id - 文件ID
 */
export function vectorizeFile(id) {
  return request({
    url: `/api/files/${id}/vectorize`,
    method: 'post'
  })
}

/**
 * 删除文件的向量数据 (保留文件)
 * @param {number} id - 文件ID
 */
export function deleteFileVectors(id) {
  return request({
    url: `/api/files/${id}/vectors`,
    method: 'delete'
  })
}

/**
 * 转换文件为文档
 * @param {number} id - 文件ID
 */
export function fileToDoc(id) {
  return request({
    url: `/api/files/${id}/toDoc`,
    method: 'post'
  })
}

/**
 * 获取文件流 (用于预览和下载)
 * 注意：request.js 会自动注入 Token 和 X-Space-Id，此处无需重复注入
 * @param {number} id - 文件ID
 */
export function getFileContent(id) {
  return request({
    url: `/api/files/${id}/content`,
    method: 'get',
    responseType: 'blob', // 关键：指定响应类型为 blob
    timeout: 60000 // 预览大文件可能需要较长时间
  })
}