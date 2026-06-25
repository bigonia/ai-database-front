// ── Node Workflow TypeScript 类型定义 ──
// 基于后端 Java record 模型

// ═══════════════════════════════════════════════════════════════════
// 能力节点 (Capability Nodes)
// ═══════════════════════════════════════════════════════════════════

interface CapabilityNodePort {
  id: string;
  direction: 'input' | 'output';
  type: string;
  displayName: string;
  required: boolean;
  schema: Record<string, unknown>;
}

interface CapabilityNodeArtifactSchema {
  name: string;
  type: string;
  displayName: string;
  required: boolean;
  schema: Record<string, unknown>;
}

/** 运行模式 */
type CapabilityNodeRuntimeMode =
  | 'TRIGGER'
  | 'ACTION'
  | 'SESSION'
  | 'UI_PATCH'
  | 'trigger'
  | 'action'
  | 'session'
  | 'ui_patch';

/** 后端 CapabilityNodeDefinition record */
interface CapabilityNodeDefinition {
  nodeType: string;
  capabilityId: string;
  instanceId: string;
  displayName: string;
  description: string;
  runtimeMode: CapabilityNodeRuntimeMode;
  inputPorts: CapabilityNodePort[];
  outputPorts: CapabilityNodePort[];
  parameters: Array<Record<string, unknown>>;
  artifacts: CapabilityNodeArtifactSchema[];
  source: Record<string, unknown>;
  constraints: Record<string, unknown>;
}

/** 后端 CapabilityNodeCatalog record */
interface CapabilityNodeCatalog {
  deviceId: string;
  online: boolean;
  status: string;
  nodes: CapabilityNodeDefinition[];
  unresolvedNodes: Array<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
// 工作流定义 (Workflow Definition)
// ═══════════════════════════════════════════════════════════════════

/** 后端 NodeWorkflowSlot record */
interface NodeWorkflowSlot {
  slotId: string;
  board: string;
  displayName: string;
  requiredCapabilities: string[];
}

/** 后端 NodeWorkflowNode record */
interface NodeWorkflowNode {
  nodeId: string;
  slotId: string;
  nodeType: string;
  params: Record<string, unknown>;
}

/** 后端 NodeWorkflowEdge record */
interface NodeWorkflowEdge {
  from: string;
  to: string;
}

/** 后端 NodeWorkflowDefinition record */
interface NodeWorkflowDefinition {
  id?: string;
  name: string;
  slots: NodeWorkflowSlot[];
  nodes: NodeWorkflowNode[];
  edges: NodeWorkflowEdge[];
  uiTemplates: Array<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
// 部署 (Deployment)
// ═══════════════════════════════════════════════════════════════════

/** 部署信息（列表项 / 详情） */
interface DeploymentInfo {
  id: string;
  workflowId: string;
  workflowName?: string;
  workflowVersion?: number;
  status: 'active' | 'stopped' | 'replaced';
  slotBindings: Record<string, string>;
  deployedAt: string;
  stoppedAt?: string;
  replacedDeployments?: string[];
  deviceStatuses?: Record<string, { slotId: string; deviceId: string; online: boolean }>;
  uiContexts?: Record<string, unknown>;
  lastRun?: {
    runId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    error?: string;
  };
  runCount?: number;
  failedRunCount?: number;
  health?: string;
  inspection?: DeploymentInspection;
}

/** 部署检查结果 */
interface DeploymentInspection {
  errors: string[];
  warnings: string[];
  conflicts: Array<{
    type: string;
    workflowName?: string;
    deploymentId?: string;
    message: string;
  }>;
  slotValidation: Record<string, {
    bound: boolean;
    deviceId?: string;
    online?: boolean;
    supportedNodeTypes?: string[];
    unsupportedNodeTypes?: string[];
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// 运行记录 (Run)
// ═══════════════════════════════════════════════════════════════════

interface RunStep {
  nodeId: string;
  slotId: string;
  deviceId: string;
  nodeType: string;
  status: 'passed' | 'failed';
  inputParams?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  createdAt?: string;
}

interface RunInfo {
  runId: string;
  workflowId: string;
  deploymentId: string;
  triggerNodeId: string;
  status: 'running' | 'passed' | 'failed' | 'ignored';
  triggerEvent?: Record<string, unknown>;
  context?: Record<string, unknown>;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
  steps?: RunStep[];
}

interface RunArtifact {
  artifactId: string;
  deviceId: string;
  nodeId?: string;
  type: string;
  mimeType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  blobUrl?: string;
  artifactRef?: string;
}

// ═══════════════════════════════════════════════════════════════════
// Section Schema (from GET /events/sections)
// ═══════════════════════════════════════════════════════════════════

interface SectionFieldSchema {
  name: string;
  type: string;        // string | int | float | bool | enum | color | array | object
  required: boolean;
  description: string | null;
  options?: string[];   // for enum fields
  children?: SectionFieldSchema[]; // for array/object fields
  min?: number;
  max?: number;
}

interface SectionTypeSchema {
  type: string;              // e.g. "hero_section"
  displayName: string;       // e.g. "Hero 数据"
  operations: string[];      // e.g. ["add", "update", "remove"]
  fields: SectionFieldSchema[];
  constraints: Record<string, unknown>;
  events: Array<{ eventId: string; description: string }>;
}

// ═══════════════════════════════════════════════════════════════════
// UI 模板 (UI Template) — 匹配后端 SduiUiTemplateService 格式
// ═══════════════════════════════════════════════════════════════════

/** 模板中一个 Section 的定义 */
interface UiTemplateSection {
  sectionId: string;
  sectionType: string;
  fields: Record<string, unknown>;
}

/** 模板变量声明 — 绑定到特定 Section 的字段 */
interface UiTemplateVariable {
  variableKey: string;    // 变量名，如 "temp"
  sectionId: string;      // 所属 sectionId
  field: string;          // 字段名，如 "value"
  type: string;           // 字段类型
  defaultValue: unknown;  // 默认值
}

/** 后端模板定义 JSON（存储在 definition 字段） */
interface UiTemplateDefinition {
  board: string;
  pageId: string;
  layout: string;
  sections: UiTemplateSection[];
  variables: UiTemplateVariable[];
  mockData?: Record<string, unknown>;
}

interface UiTemplateInfo {
  id: string;
  templateKey: string;
  name: string;
  status: string;
  definition: UiTemplateDefinition;
  createdAt: string;
  updatedAt: string;
}

/** 模板创建请求体 — templateKey 和 pageId 由后端生成 */
interface UiTemplatePayload {
  name: string;
  board: string;
  layout?: string;
  sections: Array<{
    sectionId: string;
    sectionType: string;
    fields: Record<string, unknown>;
  }>;
  variables?: UiTemplateVariable[];
  mockData?: Record<string, unknown>;
}
