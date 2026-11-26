import { useQuery } from '@tanstack/react-query';
import { type BulkEditPatch, VIDEO_VISIBILITIES } from '@vp/domain';
import { useApi } from '@vp/queries';
import { FieldDialog } from '#app/components/dialogs/field-dialog';
import type { FieldInput } from '#app/components/dialogs/field-dialog';
import { categoriesQueryOptions } from '#app/features/videos/api/category-queries';
import { NO_CATEGORY } from '#app/features/videos/forms/edit-video-values';
import {
  type BulkField,
  buildBulkPatch,
  COMMENTS_STATES,
} from '#app/features/videos/utils/bulk-fields';
import { useT } from '#app/lib/messages';

const VISIBILITY_ORDER = [...VIDEO_VISIBILITIES].reverse();

export interface LibraryFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: BulkField;
  count: number;
  onApply: (patch: BulkEditPatch) => void;
}

/** The one dialog the library's bulk bar opens, whichever field it changes. */
export function LibraryFieldDialog({
  open,
  onOpenChange,
  field,
  count,
  onApply,
}: LibraryFieldDialogProps) {
  const api = useApi();
  const { tOr } = useT();
  const categories = useQuery({
    ...categoriesQueryOptions(api),
    enabled: open && field === 'categoryId',
  });

  const inputs: Record<BulkField, FieldInput> = {
    visibility: {
      kind: 'choice',
      options: VISIBILITY_ORDER.map((value) => ({
        value,
        label: tOr('videos.visibility', { visibility: value }, ''),
      })),
    },
    categoryId: {
      kind: 'choice',
      options: [
        { value: NO_CATEGORY, label: tOr('studio.editCategoryNone', {}, '') },
        ...(categories.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
      ],
    },
    addTags: { kind: 'text', hint: tOr('studio.batchTagsHint', {}, '') },
    removeTags: { kind: 'text', hint: tOr('studio.batchTagsHint', {}, '') },
    commentsEnabled: {
      kind: 'choice',
      options: COMMENTS_STATES.map((state) => ({
        value: state,
        label: tOr('studio.batchCommentsOption', { state }, ''),
      })),
    },
  };

  const submit = (value: string) => {
    const patch = buildBulkPatch(field, value);
    if (!patch) return;
    onOpenChange(false);
    onApply(patch);
  };

  return (
    <FieldDialog
      open={open}
      onOpenChange={onOpenChange}
      title={tOr('studio.batchFieldTitle', { field }, '')}
      description={tOr('studio.batchFieldAppliesTo', { count }, '')}
      label={tOr('studio.batchFieldLabel', { field }, '')}
      input={inputs[field]}
      submitLabel={tOr('studio.batchApply', {}, '')}
      onSubmit={submit}
    />
  );
}
