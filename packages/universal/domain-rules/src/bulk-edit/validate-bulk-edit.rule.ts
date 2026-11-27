import { type Result, andThen, err, map, ok } from '@kit/result';
import { BULK_EDIT_MAX_IDS, type BulkEditPatch } from '@vp/domain';
import { type InvalidField, invalidField, validateVideoTags } from '@vp/validation';

export interface BulkEditInput {
  readonly ids: readonly string[];
  readonly patch: BulkEditPatch;
}

export type InvalidBulkEdit = InvalidField<{ readonly maxIds: number }>;

function invalid(field: 'ids' | 'patch', reason: string): InvalidBulkEdit {
  return invalidField(field, reason, { maxIds: BULK_EDIT_MAX_IDS });
}

function validateTags(patch: BulkEditPatch): Result<BulkEditPatch, InvalidBulkEdit> {
  const normalized = (tags: string[] | undefined) =>
    tags === undefined ? ok(undefined) : validateVideoTags(tags);
  const added = normalized(patch.addTags);
  const removed = normalized(patch.removeTags);
  if (!(added.ok && removed.ok)) return err(invalid('patch', 'Tags are 1 to 30 characters each'));
  return ok({
    ...patch,
    ...(added.value && { addTags: added.value }),
    ...(removed.value && { removeTags: removed.value }),
  });
}

/** The ids repeat nowhere and the patch changes something, so each id is one edit. */
export function validateBulkEdit(input: BulkEditInput): Result<BulkEditInput, InvalidBulkEdit> {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0 || ids.length > BULK_EDIT_MAX_IDS) {
    return err(invalid('ids', `Choose 1 to ${BULK_EDIT_MAX_IDS} videos`));
  }
  const changes = Object.values(input.patch).some((value) => value !== undefined);
  if (!changes) return err(invalid('patch', 'Choose something to change'));
  return map(
    andThen(validateTags(input.patch), (patch) => ok(patch)),
    (patch) => ({ ids, patch })
  );
}
