import type { SectionField } from '@/types/sdui-business';

export function utf8ByteLength(value: unknown): number {
  return new TextEncoder().encode(value == null ? '' : String(value)).length;
}

export function isOutsideLengthBounds(value: unknown, min?: number, max?: number): boolean {
  const length = utf8ByteLength(value);
  return (min != null && length < min) || (max != null && length > max);
}

export function byteLengthHint(value: unknown, min?: number, max?: number): string {
  const range = min != null && max != null ? `${min}～${max}` : min != null ? `≥${min}` : `≤${max}`;
  return `${utf8ByteLength(value)} / ${range} UTF-8 bytes`;
}

export function defaultFieldValue(
  field: SectionField,
  arrayMinimum = 0,
  makeArrayItem: () => unknown = () => 0
): unknown {
  if (field.type === 'array') return Array.from({ length: arrayMinimum }, makeArrayItem);
  if (field.defaultValue !== undefined) return structuredClone(field.defaultValue);
  if (['number', 'integer', 'int', 'float'].includes(field.type)) {
    return Math.max(field.min ?? Number.NEGATIVE_INFINITY,
      Math.min(field.max ?? Number.POSITIVE_INFINITY, 0));
  }
  if (field.type === 'boolean') return false;
  if (field.type === 'object') return {};
  return '';
}

export function defaultArrayItem(field: SectionField, makeChildValue: (child: SectionField) => unknown): unknown {
  const children = field.children || [];
  if (!children.length) return 0;
  return Object.fromEntries(children.map(child => [child.name, makeChildValue(child)]));
}

export function defaultFieldsFor(fields: SectionField[], makeValue: (field: SectionField) => unknown): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => [field.name, makeValue(field)]));
}

export function hasConfiguredUiFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some(value => value !== undefined && value !== '' &&
    !(Array.isArray(value) && value.length === 0) &&
    !(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0));
}
