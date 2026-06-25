import request from '@/utils/request';

const BASE = '/api/v1/sdui';

// ═══════════════════════════════════════════════════════════════════
// 产物 (Artifact)
// ═══════════════════════════════════════════════════════════════════

/** 查询产物元数据 */
export function getArtifactMetadata(artifactId: string): Promise<RunArtifact> {
  return request({
    url: `${BASE}/artifacts/${artifactId}`,
    method: 'get'
  });
}

/** 查询设备最近产物 */
export function getLatestDeviceArtifact(
  deviceId: string,
  type?: string
): Promise<RunArtifact> {
  return request({
    url: `${BASE}/devices/${deviceId}/artifacts/latest`,
    method: 'get',
    params: type ? { type } : undefined
  });
}

/** 构建产物 Blob 下载 URL */
export function buildArtifactBlobUrl(artifactId: string): string {
  const baseURL = import.meta.env.VITE_BASE_API || '';
  const originBase =
    typeof window !== 'undefined' ? window.location.origin : '';
  const root = new URL(baseURL || '/', originBase)
    .toString()
    .replace(/\/$/, '');
  return `${root}${BASE}/artifacts/${artifactId}/blob`;
}
