import sduiRequest from '@/api/sdui-request';
import type {
  ActionCatalogResponse, BusinessDefinition,
  BusinessEditorResources, ConfigProblem, SectionField, SectionTemplate, ValidationProjection
} from '@/types/sdui-business';

import { runSduiOperation } from '@/utils/sdui-log';

const BASE = '/api/v1/sdui';

export function parseValidationProjection(value: unknown): ValidationProjection {
  if (!isRecord(value) || typeof value.ok !== 'boolean' ||
    !Number.isInteger(value.errorCount) || Number(value.errorCount) < 0 ||
    !Number.isInteger(value.warningCount) || Number(value.warningCount) < 0 ||
    !Array.isArray(value.problems)) {
    throw new Error('业务校验响应格式无效');
  }
  const problems = value.problems.map((problem) => {
    if (!isRecord(problem) || !['error', 'warning'].includes(String(problem.severity)) ||
      typeof problem.code !== 'string' || !problem.code ||
      typeof problem.location !== 'string' || !problem.location ||
      typeof problem.fix !== 'string' || !problem.fix ||
      !(problem.expected == null || typeof problem.expected === 'string') ||
      !(problem.actual == null || typeof problem.actual === 'string') ||
      !(problem.converter == null || typeof problem.converter === 'string')) {
      throw new Error('业务校验问题列表格式无效');
    }
    return problem as unknown as ConfigProblem;
  });
  const errorCount = problems.filter((problem) => problem.severity === 'error').length;
  const warningCount = problems.length - errorCount;
  if (value.errorCount !== errorCount || value.warningCount !== warningCount || value.ok !== (errorCount === 0)) {
    throw new Error('业务校验汇总与问题列表不一致');
  }
  return { ok: value.ok, errorCount, warningCount, problems };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function listBusinesses() {
  return sduiRequest({ url: `${BASE}/businesses`, method: 'get' });
}

export function deleteBusiness(businessId: string) {
  return sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'delete' });
}

export function getBusiness(businessId: string) {
  return sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'get' });
}

export function saveBusiness(businessId: string, expectedRevision: number, definition: BusinessDefinition) {
  return runSduiOperation('business.definition.save', { businessId }, () =>
    sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}`, method: 'put', data: { expectedRevision, definition }}));
}

export function validateBusiness(businessId: string, definition?: BusinessDefinition) {
  return definition
    ? sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/diagnostics/validate-draft`, method: 'post', data: definition })
    : sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/diagnostics/validate`, method: 'get' });
}

export function getBusinessResources(businessId: string): Promise<{ data: BusinessEditorResources }> {
  return sduiRequest({ url: `${BASE}/editor/businesses/${encodeURIComponent(businessId)}/resources`, method: 'get' });
}

export function getSectionCatalog() {
  return sduiRequest({ url: `${BASE}/catalog/sections`, method: 'get' });
}

export function parseSectionCatalog(value: unknown): Record<string, SectionTemplate> {
  if (!isRecord(value)) throw new Error('界面模板目录响应格式无效');
  const parseField = (candidate: unknown, path: string): SectionField => {
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || !candidate.name ||
      typeof candidate.type !== 'string' || !candidate.type ||
      !(candidate.label == null || typeof candidate.label === 'string') ||
      !(candidate.description == null || typeof candidate.description === 'string') ||
      !(candidate.required == null || typeof candidate.required === 'boolean') ||
      !(candidate.parameterizable == null || typeof candidate.parameterizable === 'boolean') ||
      !(candidate.min == null || (typeof candidate.min === 'number' && Number.isFinite(candidate.min))) ||
      !(candidate.max == null || (typeof candidate.max === 'number' && Number.isFinite(candidate.max))) ||
      (candidate.min != null && candidate.max != null && Number(candidate.min) > Number(candidate.max)) ||
      !(candidate.options == null || (Array.isArray(candidate.options) &&
        candidate.options.every((option) => typeof option === 'string'))) ||
      !(candidate.children == null || Array.isArray(candidate.children))) {
      throw new Error(`${path} 字段定义无效`);
    }
    const type = candidate.type;
    const defaultValue = candidate.defaultValue;
    if (defaultValue !== undefined) {
      const validDefault = ['text', 'string', 'url', 'color'].includes(String(type))
        ? typeof defaultValue === 'string'
        : ['number', 'integer', 'int', 'float'].includes(String(type))
          ? typeof defaultValue === 'number' && Number.isFinite(defaultValue)
          : type === 'boolean' ? typeof defaultValue === 'boolean'
            : type === 'array' ? Array.isArray(defaultValue)
              : type === 'object' ? isRecord(defaultValue)
                : true;
      if (!validDefault) throw new Error(`${path} 默认值类型与字段类型不匹配`);
    }
    if (type !== 'array' && candidate.children != null && candidate.children.length > 0) {
      throw new Error(`${path} 非数组字段不能声明子字段`);
    }
    const children = (candidate.children || []).map((child, index) => parseField(child, `${path}.children[${index}]`));
    if (new Set(children.map((child) => child.name)).size !== children.length) {
      throw new Error(`${path} 包含重复子字段`);
    }
    return { ...candidate, children } as unknown as SectionField;
  };

  const parsed: Record<string, SectionTemplate> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!isRecord(candidate) || candidate.type !== key || typeof candidate.displayName !== 'string' ||
      !candidate.displayName || typeof candidate.interactive !== 'boolean' ||
      !Array.isArray(candidate.displayFields)) {
      throw new Error(`界面模板“${key}”定义无效`);
    }
    const fields = candidate.displayFields.map((field, index) => parseField(field, `${key}.displayFields[${index}]`));
    if (new Set(fields.map((field) => field.name)).size !== fields.length) {
      throw new Error(`界面模板“${key}”包含重复字段`);
    }
    const constraints = candidate.constraints;
    if (constraints != null && (!isRecord(constraints) ||
      Object.values(constraints).some((constraint) => !Number.isSafeInteger(constraint)))) {
      throw new Error(`界面模板“${key}”约束定义无效`);
    }
    const arrayFieldNames = new Set(fields.filter((field) => field.type === 'array').map((field) => field.name));
    const arrayCountConstraint = (name: string) => [...arrayFieldNames]
      .some((fieldName) => name === `${fieldName}_min` || name === `${fieldName}_max`);
    if (constraints && Object.entries(constraints).some(([name, constraint]) =>
      arrayCountConstraint(name) && Number(constraint) < 0)) {
      throw new Error(`界面模板“${key}”数组项数约束不能为负数`);
    }
    if (constraints && Object.entries(constraints).some(([name, minimum]) =>
      [...arrayFieldNames].some((fieldName) => name === `${fieldName}_min` &&
        constraints[`${fieldName}_max`] != null &&
        Number(minimum) > Number(constraints[`${fieldName}_max`] as number)))) {
      throw new Error(`界面模板“${key}”数组最小项数不能大于最大项数`);
    }
    parsed[key] = { type: key, displayName: candidate.displayName, interactive: candidate.interactive,
      displayFields: fields, constraints: constraints as Record<string, number> | undefined };
  }
  return parsed;
}

export function getTriggerCatalog() {
  return sduiRequest({ url: `${BASE}/catalog/triggers`, method: 'get' });
}

export function getActionCatalog(deviceId?: string) {
  return sduiRequest({ url: `${BASE}/actions/catalog`, method: 'get', params: deviceId ? { deviceId } : undefined });
}

export function parseActionCatalog(value: unknown, expectedDeviceId?: string): ActionCatalogResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('动作目录响应格式无效');
  const data = value as Record<string, unknown>;
  if (!(data.deviceId === null || typeof data.deviceId === 'string') ||
    data.deviceId !== (expectedDeviceId || null) ||
    typeof data.schemaSynced !== 'boolean' ||
    !Number.isInteger(data.count) || Number(data.count) < 0 ||
    !Array.isArray(data.actions) || data.count !== data.actions.length) {
    throw new Error('动作目录身份、计数或同步状态与请求不匹配');
  }
  const names = new Set<string>();
  for (const item of data.actions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('动作目录条目格式无效');
    const action = item as Record<string, unknown>;
    if (typeof action.action !== 'string' || !action.action || names.has(action.action) ||
      !(action.role === undefined || typeof action.role === 'string') ||
      !(action.version === undefined || typeof action.version === 'string') ||
      !(action.source === undefined || typeof action.source === 'string') ||
      !(action.timeoutMs === undefined || action.timeoutMs === null || (Number.isInteger(action.timeoutMs) && Number(action.timeoutMs) >= 0)) ||
      !(action.errors === undefined || action.errors === null || (Array.isArray(action.errors) && action.errors.every((error) => typeof error === 'string'))) ||
      !(action.idempotent === undefined || typeof action.idempotent === 'boolean') ||
      !(action.description === undefined || action.description === null || typeof action.description === 'string') ||
      !(action.parametersSource === undefined || action.parametersSource === null || typeof action.parametersSource === 'string') ||
      !(action.parameters === undefined || action.parameters === null || (Array.isArray(action.parameters) && action.parameters.every(isActionParameter))) ||
      !(action.in === undefined || isStringMap(action.in)) ||
      !(action.out === undefined || isStringMap(action.out)) ||
      !(action.usableIn === undefined || action.usableIn === null || (Array.isArray(action.usableIn) && action.usableIn.every((surface) => typeof surface === 'string')))) {
      throw new Error('动作目录条目字段格式无效或存在重复动作名');
    }
    names.add(action.action);
  }
  return value as ActionCatalogResponse;
}

function isActionParameter(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const parameter = value as Record<string, unknown>;
  return typeof parameter.name === 'string' && parameter.name.length > 0 &&
    typeof parameter.type === 'string' && parameter.type.length > 0 &&
    (parameter.required === undefined || parameter.required === null || typeof parameter.required === 'boolean') &&
    (parameter.min === undefined || parameter.min === null || Number.isFinite(parameter.min)) &&
    (parameter.max === undefined || parameter.max === null || Number.isFinite(parameter.max)) &&
    (parameter.unit === undefined || parameter.unit === null || typeof parameter.unit === 'string') &&
    (parameter.values === undefined || parameter.values === null || Array.isArray(parameter.values));
}

function isStringMap(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string');
}
