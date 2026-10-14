export interface BusinessSummary {
  businessId: string;
  name: string;
  description: string | null;
  revision: number;
  uis: number;
  flows: string[];
  mirror: boolean;
}

export interface BusinessUiResource {
  key: string;
  owner: 'local' | 'target';
  template: string;
  fields: Record<string, unknown>;
}

export interface BusinessEditorResources {
  businessId: string;
  uis: Array<{
    kind: string;
    key: string;
    owner: 'local' | 'target' | null;
    template: string;
    initial: boolean;
    origin: string;
    referencedBy: string[];
  }>;
  values: Array<{
    kind: string;
    name: string;
    type: string;
    flowKey: string;
    origin: string;
    fromTrigger: boolean;
    stepIndex: number;
    transient: boolean;
  }>;
}

export interface BusinessStep {
  action: string;
  target?: 'local' | 'target';
  with: Record<string, unknown>;
  produces?: Record<string, string>;
  ui?: string;
  bind: Record<string, unknown>;
}

export interface DeviceFlowEntry {
  kind: 'device';
  ui?: string;
  interaction?: string;
}

export interface ExternalFlowEntry {
  kind: 'external';
  name?: string;
  values: Record<string, string>;
  valueDescriptions: Record<string, string>;
}

export interface BusinessFlow {
  key: string;
  entry?: DeviceFlowEntry | ExternalFlowEntry;
  steps: BusinessStep[];
}

export interface BusinessDefinition {
  id: string;
  name: string;
  description?: string;
  devices?: { local?: Record<string, never>; target?: Record<string, never> };
  uis: BusinessUiResource[];
  flows: BusinessFlow[];
  mirror?: boolean;
}

export interface ConfigProblem {
  severity: 'error' | 'warning';
  code: string;
  location: string;
  expected?: string;
  actual?: string;
  fix: string;
  converter?: string;
}

export interface ValidationProjection {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  problems: ConfigProblem[];
}

export interface SectionField {
  name: string;
  type: string;
  label?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  options?: string[];
  description?: string;
  required?: boolean;
  parameterizable?: boolean;
  children?: SectionField[];
}

export interface SectionTemplate {
  type: string;
  displayName: string;
  interactive: boolean;
  displayFields: SectionField[];
  constraints?: Record<string, number>;
}

export interface ActionCatalogEntry {
  action: string;
  role?: string;
  version?: string;
  source?: string;
  timeoutMs?: number;
  errors?: string[];
  idempotent?: boolean;
  description?: string;
  parameters?: ActionParameterDocumentation[];
  parametersSource?: string;
  in?: Record<string, string>;
  out?: Record<string, string>;
  usableIn?: string[];
}

export interface ActionCatalogResponse {
  deviceId: string | null;
  schemaSynced: boolean;
  count: number;
  actions: ActionCatalogEntry[];
}

export interface ActionParameterDocumentation {
  name: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  values?: unknown[];
}
