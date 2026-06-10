/**
 * 设备数据规范化工具
 * 统一前后端字段名差异，供 devices.vue、dashboard.vue 共享
 */

export const HEALTH_LEVEL_COLORS = {
  HEALTHY: '#22c55e',
  WARNING: '#eab308',
  CRITICAL: '#ef4444',
  UNKNOWN: '#9ca3af'
};

export const HEALTH_LEVEL_TAG_TYPES = {
  HEALTHY: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'info'
};

export const HEALTH_LEVEL_LABELS = {
  HEALTHY: '健康',
  WARNING: '告警',
  CRITICAL: '严重',
  UNKNOWN: '未知'
};

/**
 * 告警码 → 人类可读的描述和建议操作
 * 参考 DEVICE_DASHBOARD_FRONTEND_GUIDE.md Section 5.2
 */
export const WARNING_INFO = {
  battery_low: { label: '电量过低', suggestion: '请尽快充电', level: 'WARNING' },
  memory_fragmented: { label: '内存碎片严重', suggestion: '建议重启设备', level: 'WARNING' },
  overheating: { label: '设备过热', suggestion: '请检查散热条件', level: 'CRITICAL' },
  weak_signal: { label: 'WiFi 信号弱', suggestion: '请检查 WiFi 覆盖', level: 'WARNING' },
  memory_low: { label: '内存不足', suggestion: '可能需重启设备', level: 'CRITICAL' },
  unstable_connection: { label: '连接不稳定', suggestion: '请检查网络稳定性', level: 'WARNING' },
  device_offline: { label: '设备离线', suggestion: '设备已断开连接', level: 'CRITICAL' }
};

/**
 * 规范化设备列表项
 * @param {Object} d - 后端返回的原始设备数据
 * @returns {Object} 规范化后的设备对象
 */
export function normalizeDevice(d) {
  return {
    ...d,
    deviceName: d.name || d.deviceName,
    online: d.status === 'ONLINE',
    lastSeen: d.lastSeenAt || d.lastSeen,
    lastTelemetry: d.lastTelemetry ? {
      wifiRssi: d.lastTelemetry?.wifi?.rssi ?? null,
      ip: d.lastTelemetry?.wifi?.ip ?? null,
      temperature: d.lastTelemetry?.temperature?.celsius ?? null,
      batteryPct: d.lastTelemetry?.power?.batteryPct ?? null,
      charging: d.lastTelemetry?.power?.charging ?? false,
      freeHeapInternal: d.lastTelemetry?.memory?.freeHeapInternal ?? null,
      freeHeapTotal: d.lastTelemetry?.memory?.freeHeapTotal ?? null,
      fragInternalPct: d.lastTelemetry?.memory?.fragInternalPct ?? null,
      uptimeS: d.lastTelemetry?.uptimeS ?? null,
      lastHeartbeatAt: d.lastTelemetry?.lastHeartbeatAt ?? null
    } : null
  };
}

/**
 * 规范化设备详情（比列表项有更多字段）
 * @param {Object} d - 后端返回的原始设备详情数据
 * @returns {Object} 规范化后的设备详情对象
 */
export function normalizeDetail(d) {
  return {
    ...normalizeDevice(d),
    connectedAt: d.connectedAt || null,
    sessionId: d.sessionId || null,
    connectionCount: d.connectionCount ?? null,
    totalUptimeS: d.totalUptimeS ?? null,
    sizeClass: d.sizeClass || null,
    capabilities: d.capabilities || null,
    availableCommands: d.availableCommands || [],
    recentCommands: d.recentCommands || [],
    profile: d.profile || {
      board: d.board,
      screenShape: d.screenShape,
      screenSize: d.screenWidth && d.screenHeight ? `${d.screenWidth}x${d.screenHeight}` : '',
      inputMode: d.inputMode
    },
    notes: d.notes || '',
    claimed: d.registrationStatus === 'CLAIMED' || d.claimed || false,
    claimedAt: d.claimedAt || null,
    createdAt: d.createdAt || null
  };
}

/**
 * 格式化运行时长
 * @param {number|null} seconds
 * @returns {string}
 */
export function formatUptime(seconds) {
  if (seconds == null) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

/**
 * 获取健康等级对应的颜色
 * @param {string} level
 * @returns {string}
 */
export function healthLevelColor(level) {
  return HEALTH_LEVEL_COLORS[level] || HEALTH_LEVEL_COLORS.UNKNOWN;
}

/**
 * 获取健康等级对应的 el-tag type
 * @param {string} level
 * @returns {string}
 */
export function healthLevelTagType(level) {
  return HEALTH_LEVEL_TAG_TYPES[level] || 'info';
}

/**
 * 获取健康等级的中文标签
 * @param {string} level
 * @returns {string}
 */
export function healthLevelLabel(level) {
  return HEALTH_LEVEL_LABELS[level] || '未知';
}
