import request from '@/utils/request';

const BASE = '/api/v1/sdui/ui-templates';

// ═══════════════════════════════════════════════════════════════════
// Section Schema (from /api/v1/sdui/events/sections)
// ═══════════════════════════════════════════════════════════════════

/** 获取全局 Section 类型 Schema */
export function getSectionTypeSchemas(): Promise<SectionTypeSchema[]> {
  return request({
    url: '/api/v1/sdui/events/sections',
    method: 'get'
  });
}

// ═══════════════════════════════════════════════════════════════════
// UI 模板 CRUD
// ═══════════════════════════════════════════════════════════════════

/** 模板列表 */
export function listTemplates(): Promise<UiTemplateInfo[]> {
  return request({ url: BASE, method: 'get' });
}

/** 模板详情 */
export function getTemplate(templateId: string): Promise<UiTemplateInfo> {
  return request({ url: `${BASE}/${templateId}`, method: 'get' });
}

/** 创建模板 — templateKey 和 pageId 由后端自动生成 */
export function createTemplate(
  data: UiTemplatePayload
): Promise<UiTemplateInfo> {
  return request({ url: BASE, method: 'post', data });
}

/** 更新模板 */
export function updateTemplate(
  templateId: string,
  data: Partial<UiTemplatePayload>
): Promise<UiTemplateInfo> {
  return request({
    url: `${BASE}/${templateId}`,
    method: 'put',
    data
  });
}

/** 删除模板 */
export function deleteTemplate(templateId: string): Promise<void> {
  return request({ url: `${BASE}/${templateId}`, method: 'delete' });
}

/** 预览模板（可选推送到设备） */
export function previewTemplate(
  templateId: string,
  body?: { variables?: Record<string, unknown>; push?: boolean; deviceId?: string }
): Promise<Record<string, unknown>> {
  return request({
    url: `${BASE}/${templateId}/preview`,
    method: 'post',
    data: body || {}
  });
}
