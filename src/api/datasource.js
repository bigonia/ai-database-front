import request from '@/utils/request';

// 获取列表接口 (带分页和查询)
export function fetchList(query) {
  return request({
    url: '/api/database-info',
    method: 'get',
    params: query
  });
}

// 获取单个数据源的详细信息
export function fetchDatasource(id) {
  return request({
    url: `/api/database-info/${id}`,
    method: 'get'
  });
}

// 创建数据源接口
export function createDatasource(data) {
  return request({
    url: '/api/database-info',
    method: 'post',
    data
  });
}

// 更新数据源
export function updateDatasource(id, data) {
  return request({
    url: `/api/database-info/${id}`,
    method: 'put',
    data
  });
}

// 删除数据源
export function deleteDatasource(id) {
  return request({
    url: `/api/database-info/${id}`,
    method: 'delete'
  });
}

// 测试连接 (通过 DTO)
export function testConnectionByData(data) {
  return request({
    url: '/api/database-info/test-connection',
    method: 'post',
    data
  });
}

// 测试已保存的连接 (通过 ID)
export function testConnectionById(id) {
  return request({
    url: `/api/database-info/${id}/test-connection`,
    method: 'post'
  });
}

// --- 新增接口：结构浏览与文档化 ---

// 1. 获取 Schemas 列表
export function getSchemas(id) {
  return request({
    url: `/api/database-info/schemas/${id}`,
    method: 'get'
  });
}

// 2. 获取 Tables 列表
export function getTables(id, schema) {
  return request({
    url: `/api/database-info/${id}/${schema}`,
    method: 'get'
  });
}

// 3. 获取 Columns 列表
export function getColumns(id, schema, table) {
  return request({
    url: `/api/database-info/${id}/${schema}/${table}`,
    method: 'get'
  });
}

// 4. 生成全库元数据 (画像)
export function generateMetadata(id) {
  return request({
    url: `/api/database-info/${id}/metadata`,
    method: 'post'
  });
}

// 5. 表数据流式化配置
// 注意：后端接收 @RequestBody String template，发送 text/plain 格式以避免 JSON 转义问题
export function streamTable(id, schema, table, templateContent) {
  return request({
    url: `/api/database-info/${id}/${schema}/${table}/stream`,
    method: 'post',
    headers: {
      'Content-Type': 'text/plain' // 明确指定发送纯文本
    },
    data: templateContent
  });
}