import request from '@/utils/request';

const BASE = '/api/v1/sdui';

// ═══════════════════════════════════════════════════════════════════
// 能力节点查询
// ═══════════════════════════════════════════════════════════════════

/** 查询真实设备的能力节点 */
export function getCapabilityNodesForDevice(deviceId: string): Promise<CapabilityNodeCatalog> {
  return request({
    url: `${BASE}/capability-nodes/${deviceId}`,
    method: 'get'
  });
}

/** 查询板卡类型的能力节点（无需真实设备） */
export function getCapabilityNodesForBoardType(board: string): Promise<CapabilityNodeCatalog> {
  return request({
    url: `${BASE}/board-types/${encodeURIComponent(board)}/capability-nodes`,
    method: 'get'
  });
}
