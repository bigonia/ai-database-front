import { shallowRef } from 'vue';
import type { Node, Edge } from '@vue-flow/core';

// ── 运行模式 → 颜色映射 ──
export const RUNTIME_MODE_COLORS: Record<string, string> = {
  TRIGGER: '#52c41a',
  ACTION: '#1677ff',
  SESSION: '#fa8c16',
  UI_PATCH: '#722ed1'
};

export const RUNTIME_MODE_LABELS: Record<string, string> = {
  TRIGGER: '触发',
  ACTION: '动作',
  SESSION: '会话',
  UI_PATCH: 'UI 更新'
};

// ── 后端节点 → Vue Flow 节点 ──
export function workflowNodeToVueFlow(
  wn: NodeWorkflowNode,
  slot: NodeWorkflowSlot,
  capabilityNode: CapabilityNodeDefinition | null,
  index: number
): Node {
  const runtimeMode = String(capabilityNode?.runtimeMode || 'ACTION').toUpperCase();
  const modeColor =
    RUNTIME_MODE_COLORS[runtimeMode] || '#8c8c8c';
  const modeLabel =
    RUNTIME_MODE_LABELS[runtimeMode] || '';

  return {
    id: wn.nodeId,
    type: 'custom',
    position: {
      x: 250 + (index % 3) * 320,
      y: 120 + Math.floor(index / 3) * 180
    },
    data: {
      nodeId: wn.nodeId,
      slotId: wn.slotId,
      slotLabel: slot.displayName || slot.slotId,
      nodeType: wn.nodeType,
      displayName: capabilityNode?.displayName || wn.nodeType,
      runtimeMode,
      modeColor,
      modeLabel,
      params: wn.params || {},
      inputPorts: capabilityNode?.inputPorts || [],
      outputPorts: capabilityNode?.outputPorts || []
    }
  };
}

// ── 后端连线 → Vue Flow 连线 ──
export function workflowEdgeToVueFlow(edge: NodeWorkflowEdge): Edge {
  return {
    id: `e-${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    animated: false
  };
}

// ── Vue Flow 连线 → 后端连线 ──
export function vueFlowEdgeToWorkflow(edge: Edge): NodeWorkflowEdge {
  return {
    from: edge.source,
    to: edge.target
  };
}

// ── 生成唯一节点 ID ──
let nodeCounter = 0;
export function generateNodeId(): string {
  return `node_${Date.now()}_${++nodeCounter}`;
}

// ── Composable ──
export function useWorkflowGraph() {
  const vueFlowNodes = shallowRef<Node[]>([]);
  const vueFlowEdges = shallowRef<Edge[]>([]);

  /** 从完整工作流定义构建 Vue Flow 图形 */
  function buildGraph(
    workflowNodes: NodeWorkflowNode[],
    workflowEdges: NodeWorkflowEdge[],
    slots: NodeWorkflowSlot[],
    capabilityDefsMap: Record<string, CapabilityNodeDefinition>
  ) {
    const slotMap = new Map(slots.map((s) => [s.slotId, s]));
    const positions = new Map(
      vueFlowNodes.value.map((node) => [node.id, node.position])
    );

    vueFlowNodes.value = workflowNodes.map((wn, i) => {
      const slot = slotMap.get(wn.slotId);
      const capDef = capabilityDefsMap[wn.nodeType] || null;
      const node = workflowNodeToVueFlow(
        wn,
        slot || { slotId: wn.slotId, board: '', displayName: wn.slotId, requiredCapabilities: [] },
        capDef,
        i
      );
      node.position = positions.get(wn.nodeId) || node.position;
      return node;
    });

    vueFlowEdges.value = workflowEdges.map(workflowEdgeToVueFlow);
  }

  /** 从 Vue Flow 状态提取后端数据 */
  function extractWorkflowData(): {
    nodes: NodeWorkflowNode[];
    edges: NodeWorkflowEdge[];
    } {
    const nodes: NodeWorkflowNode[] = vueFlowNodes.value.map((n) => ({
      nodeId: n.id,
      slotId: n.data.slotId || '',
      nodeType: n.data.nodeType || '',
      params: n.data.params || {}
    }));

    const edges: NodeWorkflowEdge[] = vueFlowEdges.value.map(
      vueFlowEdgeToWorkflow
    );

    return { nodes, edges };
  }

  /** 添加节点到画布 */
  function addNode(
    capDef: CapabilityNodeDefinition,
    slotId: string,
    position: { x: number; y: number },
    slotLabel: string
  ) {
    const runtimeMode = String(capDef.runtimeMode || 'ACTION').toUpperCase();
    const nodeId = generateNodeId();
    const newNode: Node = {
      id: nodeId,
      type: 'custom',
      position,
      data: {
        nodeId,
        slotId,
        slotLabel,
        nodeType: capDef.nodeType,
        displayName: capDef.displayName,
        runtimeMode,
        modeColor:
          RUNTIME_MODE_COLORS[runtimeMode] || '#8c8c8c',
        modeLabel: RUNTIME_MODE_LABELS[runtimeMode] || '',
        params: {},
        inputPorts: capDef.inputPorts || [],
        outputPorts: capDef.outputPorts || []
      }
    };
    vueFlowNodes.value = [...vueFlowNodes.value, newNode];
    return nodeId;
  }

  /** 删除节点 */
  function removeNode(nodeId: string) {
    vueFlowNodes.value = vueFlowNodes.value.filter((n) => n.id !== nodeId);
    vueFlowEdges.value = vueFlowEdges.value.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );
  }

  /** 更新节点参数 */
  function updateNodeParams(nodeId: string, params: Record<string, unknown>) {
    vueFlowNodes.value = vueFlowNodes.value.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, params }}
        : node
    );
  }

  return {
    vueFlowNodes,
    vueFlowEdges,
    buildGraph,
    extractWorkflowData,
    addNode,
    removeNode,
    updateNodeParams
  };
}
