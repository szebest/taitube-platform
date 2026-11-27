import type { VideoVisibility } from './status-vocabulary';

export const BULK_EDIT_MAX_IDS = 100;
export const BULK_EDIT_MAX_CONCURRENCY = 4;

export interface BulkEditPatch {
  visibility?: VideoVisibility;
  categoryId?: string | null;
  addTags?: string[];
  removeTags?: string[];
  commentsEnabled?: boolean;
}

/** Added tags join the current ones and removed tags leave them, comparing without case. */
export function mergeTags(
  current: readonly string[],
  add: readonly string[] = [],
  remove: readonly string[] = []
): string[] {
  const removed = new Set(remove.map((tag) => tag.trim().toLowerCase()));
  const kept = current.filter((tag) => !removed.has(tag.toLowerCase()));
  const known = new Set(kept.map((tag) => tag.toLowerCase()));
  const added = add
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (removed.has(key) || known.has(key)) return false;
      known.add(key);
      return true;
    });
  return [...kept, ...added];
}
