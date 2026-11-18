import { assertNever } from '@kit/result';
import { type BulkEditPatch, VIDEO_VISIBILITIES } from '@vp/domain';
import { NO_CATEGORY } from '#app/features/videos/forms/edit-video-values';

export const BULK_FIELDS = [
  'visibility',
  'categoryId',
  'addTags',
  'removeTags',
  'commentsEnabled',
] as const;

export type BulkField = (typeof BULK_FIELDS)[number];

export const COMMENTS_STATES = ['on', 'off'] as const;

const splitTags = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

/** The bulk patch a dialog's value stands for, or `null` when the value names nothing to change. */
export function buildBulkPatch(field: BulkField, value: string): BulkEditPatch | null {
  switch (field) {
    case 'visibility': {
      const visibility = VIDEO_VISIBILITIES.find((option) => option === value);
      return visibility ? { visibility } : null;
    }
    case 'categoryId':
      return { categoryId: value === NO_CATEGORY ? null : value };
    case 'addTags': {
      const addTags = splitTags(value);
      return addTags.length > 0 ? { addTags } : null;
    }
    case 'removeTags': {
      const removeTags = splitTags(value);
      return removeTags.length > 0 ? { removeTags } : null;
    }
    case 'commentsEnabled': {
      const state = COMMENTS_STATES.find((option) => option === value);
      return state ? { commentsEnabled: state === 'on' } : null;
    }
    default:
      return assertNever(field, 'BulkField');
  }
}
