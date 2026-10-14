export type StatusTagType = 'success' | 'danger' | 'warning';

export interface DeploymentResultSummaryPart {
  label: string;
  type: StatusTagType;
}

const RUN_STATUS_LABELS: Record<string, string> = {
  ok: '成功',
  passed: '成功',
  success: '成功',
  failed: '失败',
  running: '运行中'
};

const DEPLOYMENT_DEVICE_STATUS_LABELS: Record<string, string> = {
  ok: '已安装',
  failed: '失败',
  skipped: '离线跳过',
  installing: '安装中',
  pending: '待安装',
  uninstalled: '已卸载',
  uninstall_pending: '卸载中',
  uninstall_failed: '卸载失败',
  uninstall_skipped: '卸载跳过',
  active: '运行中',
  stopped: '已停止',
  failed_deployment: '部署失败'
};

const DEPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: '活动',
  stopped: '已停止',
  failed: '部署失败'
};

export function runStatusType(status: string): StatusTagType {
  if (['ok', 'passed', 'success'].includes(status)) return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] || status || '未知';
}

export function deploymentDeviceStatusType(value?: string): StatusTagType {
  if (['ok', 'uninstalled', 'installed', 'active', 'success'].includes(value || '')) return 'success';
  if (['failed', 'uninstall_failed', 'error', 'blocked'].includes(value || '')) return 'danger';
  return 'warning';
}

export function deploymentDeviceStatusLabel(value?: string): string {
  return DEPLOYMENT_DEVICE_STATUS_LABELS[value || ''] || value || '未知状态';
}

export function deploymentStatusLabel(value?: string): string {
  return DEPLOYMENT_STATUS_LABELS[value || ''] || value || '读取中';
}

export function deploymentResultSummary(statuses: string[]): DeploymentResultSummaryPart[] {
  if (!statuses.length) return [{ label: '等待结果', type: 'warning' }];
  const groups: Array<{ values: string[]; label: string; type: StatusTagType }> = [
    { values: ['ok'], label: '已安装', type: 'success' },
    { values: ['failed', 'uninstall_failed'], label: '失败', type: 'danger' },
    { values: ['installing', 'uninstall_pending'], label: '处理中', type: 'warning' },
    { values: ['skipped', 'uninstall_skipped'], label: '跳过', type: 'warning' },
    { values: ['uninstalled'], label: '已卸载', type: 'warning' }
  ];
  return groups.flatMap(group => {
    const count = statuses.filter(status => group.values.includes(status)).length;
    return count ? [{ label: `${count} ${group.label}`, type: group.type }] : [];
  });
}
