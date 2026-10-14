import type { BusinessDefinition, ValidationProjection } from '@/types/sdui-business';
import { definitionSnapshot } from '@/sdui/businessDraft';

export type SavedBusinessDraft = {
  revision: number;
  definition: BusinessDefinition;
};

type RequestIdentity = {
  businessId: string;
  generation: number;
  isCurrent: (businessId: string, generation: number) => boolean;
};

export async function saveBusinessDraft(input: RequestIdentity & {
  definition: BusinessDefinition;
  revision: number;
  getEditRevision: () => number;
  save: (businessId: string, revision: number, definition: BusinessDefinition) => Promise<SavedBusinessDraft>;
}): Promise<{ kind: 'stale' } | { kind: 'failure'; message: string } | {
  kind: 'saved'; result: SavedBusinessDraft; unchangedSinceSubmit: boolean;
}> {
  const submittedRevision = input.getEditRevision();
  try {
    const result = await input.save(input.businessId, input.revision, definitionSnapshot(input.definition));
    if (!input.isCurrent(input.businessId, input.generation)) return { kind: 'stale' };
    return {
      kind: 'saved',
      result,
      unchangedSinceSubmit: input.getEditRevision() === submittedRevision
    };
  } catch (error) {
    if (!input.isCurrent(input.businessId, input.generation)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error ? error.message : '' };
  }
}

export async function validateBusinessDraft(input: RequestIdentity & {
  definition: BusinessDefinition;
  getEditRevision: () => number;
  validate: (businessId: string, definition: BusinessDefinition) => Promise<ValidationProjection>;
}): Promise<{ kind: 'stale' } | { kind: 'changed' } | { kind: 'failure'; message: string } | {
  kind: 'validated'; result: ValidationProjection;
}> {
  const validatedRevision = input.getEditRevision();
  try {
    const result = await input.validate(input.businessId, definitionSnapshot(input.definition));
    if (!input.isCurrent(input.businessId, input.generation)) return { kind: 'stale' };
    if (input.getEditRevision() !== validatedRevision) return { kind: 'changed' };
    return { kind: 'validated', result };
  } catch (error) {
    if (!input.isCurrent(input.businessId, input.generation)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error ? error.message : '' };
  }
}
