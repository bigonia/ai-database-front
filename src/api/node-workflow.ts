import request from '@/utils/request';

const BASE = '/api/v1/sdui/node-workflows';

// ═══════════════════════════════════════════════════════════════════
// 工作流定义 CRUD
// ═══════════════════════════════════════════════════════════════════

/** 工作流列表 */
export function listWorkflows(): Promise<NodeWorkflowDefinition[]> {
  return request({ url: BASE, method: 'get' });
}

/** 工作流详情 */
export function getWorkflow(workflowId: string): Promise<NodeWorkflowDefinition> {
  return request({ url: `${BASE}/${workflowId}`, method: 'get' });
}

/** 创建工作流 */
export function createWorkflow(
  data: NodeWorkflowDefinition
): Promise<NodeWorkflowDefinition> {
  return request({ url: BASE, method: 'post', data });
}

/** 更新工作流 */
export function updateWorkflow(
  workflowId: string,
  data: NodeWorkflowDefinition
): Promise<NodeWorkflowDefinition> {
  return request({ url: `${BASE}/${workflowId}`, method: 'put', data });
}

/** 删除工作流（不能有活跃部署） */
export function deleteWorkflow(workflowId: string): Promise<void> {
  return request({ url: `${BASE}/${workflowId}`, method: 'delete' });
}

/** 校验工作流定义（不持久化） */
export function validateWorkflow(
  data: NodeWorkflowDefinition
): Promise<{ valid: boolean; errors: string[] }> {
  return request({ url: `${BASE}/validate`, method: 'post', data });
}

// ═══════════════════════════════════════════════════════════════════
// 部署
// ═══════════════════════════════════════════════════════════════════

/** 部署工作流（将槽位绑定到真实设备） */
export function deployWorkflow(
  workflowId: string,
  body: { slotBindings: Record<string, string> }
): Promise<{
  deployment: DeploymentInfo;
  replacedDeployments: string[];
  inspection: DeploymentInspection;
  uiContexts: Record<string, unknown>;
}> {
  return request({
    url: `${BASE}/${workflowId}/deployments`,
    method: 'post',
    data: body
  });
}

/** 部署列表 */
export function listDeployments(
  workflowId: string
): Promise<DeploymentInfo[]> {
  return request({
    url: `${BASE}/${workflowId}/deployments`,
    method: 'get'
  });
}

/** 部署详情（含 UI 上下文） */
export function getDeployment(
  workflowId: string,
  deploymentId: string
): Promise<DeploymentInfo> {
  return request({
    url: `${BASE}/${workflowId}/deployments/${deploymentId}`,
    method: 'get'
  });
}

/** 停止部署 */
export function stopDeployment(
  workflowId: string,
  deploymentId: string
): Promise<void> {
  return request({
    url: `${BASE}/${workflowId}/deployments/${deploymentId}`,
    method: 'delete'
  });
}

/** 校验部署绑定（空跑） */
export function validateDeployment(
  workflowId: string,
  body: { slotBindings: Record<string, string> }
): Promise<{ valid: boolean; errors: string[] }> {
  return request({
    url: `${BASE}/${workflowId}/deployments/validate`,
    method: 'post',
    data: body
  });
}

/** 部署前全面检查（错误、警告、冲突） */
export function inspectDeployment(
  workflowId: string,
  body?: { slotBindings?: Record<string, string> }
): Promise<DeploymentInspection> {
  return request({
    url: `${BASE}/${workflowId}/deployments/inspect`,
    method: 'post',
    data: body || {}
  });
}

/** 手动触发测试 */
export function testTrigger(
  workflowId: string,
  deploymentId: string,
  body?: { triggerNodeId?: string; eventId?: string }
): Promise<RunInfo> {
  return request({
    url: `${BASE}/${workflowId}/deployments/${deploymentId}/test-trigger`,
    method: 'post',
    data: body || {}
  });
}

// ═══════════════════════════════════════════════════════════════════
// 运行记录
// ═══════════════════════════════════════════════════════════════════

/** 某部署的运行列表 */
export function listDeploymentRuns(
  workflowId: string,
  deploymentId: string
): Promise<RunInfo[]> {
  return request({
    url: `${BASE}/${workflowId}/deployments/${deploymentId}/runs`,
    method: 'get'
  });
}

/** 运行详情（含步骤） */
export function getRun(
  workflowId: string,
  runId: string
): Promise<RunInfo> {
  return request({
    url: `${BASE}/${workflowId}/runs/${runId}`,
    method: 'get'
  });
}

/** 运行关联的产物列表 */
export function getRunArtifacts(
  workflowId: string,
  runId: string
): Promise<RunArtifact[]> {
  return request({
    url: `${BASE}/${workflowId}/runs/${runId}/artifacts`,
    method: 'get'
  });
}
