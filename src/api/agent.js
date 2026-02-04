import request from '@/utils/request';

const BASE_URL = '/api/v1/agent';

/**
 * ==========================================
 * 3. 资源配置接口 (Configuration Resources)
 * ==========================================
 */

// 3.1 获取可用模型列表
export function getModelList() {
  return request({
    url: `${BASE_URL}/models`,
    method: 'get'
  });
}

// 3.2 获取可用 Advisor 列表
export function getAdvisorList() {
  return request({
    url: `${BASE_URL}/advisors`,
    method: 'get'
  });
}

// 3.3 获取工具库详情
export function getToolList() {
  return request({
    url: `${BASE_URL}/tools`,
    method: 'get'
  });
}

/**
 * ==========================================
 * 4. Agent 生命周期管理 (Agent Management)
 * ==========================================
 */

// 4.1 获取 Agent 列表
export function getAgentList() {
  return request({
    url: `${BASE_URL}/agents/list`,
    method: 'get'
  });
}

// 4.2 获取 Agent 详情
export function getAgentDetail(id) {
  return request({
    url: `${BASE_URL}/agents/${id}`,
    method: 'get'
  });
}

// 4.3 创建 Agent
export function createAgent(data) {
  return request({
    url: `${BASE_URL}/agents`,
    method: 'post',
    data
  });
}

// 4.4 更新 Agent
export function updateAgent(id, data) {
  return request({
    url: `${BASE_URL}/agents/${id}`,
    method: 'put',
    data
  });
}

// 4.5 删除 Agent
export function deleteAgent(id) {
  return request({
    url: `${BASE_URL}/agents/${id}`,
    method: 'delete'
  });
}

/**
 * ==========================================
 * 5. 模型注册管理 (Model Registry)
 * ==========================================
 */

// 5.1 注册新模型
export function registerModel(data) {
  return request({
    url: `${BASE_URL}/model`,
    method: 'post',
    data
  });
}

// 5.2 删除模型
export function deleteModel(name) {
  return request({
    url: `${BASE_URL}/model/${name}`,
    method: 'delete'
  });
}