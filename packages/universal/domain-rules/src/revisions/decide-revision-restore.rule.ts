import type { VideoMetadataSnapshot } from '@vp/domain';
import type { VideoMetadataPatch } from '../videos/update-metadata.rule';

/**
 * Only the fields that differ, so the restore goes through the same field rules as any edit, a
 * takedown's `visibility` lock included, and a field that already matches is never rewritten.
 */
export function decideRevisionRestore(
  current: VideoMetadataSnapshot,
  target: VideoMetadataSnapshot
): VideoMetadataPatch {
  const differs = <K extends keyof VideoMetadataSnapshot>(field: K) =>
    JSON.stringify(current[field]) !== JSON.stringify(target[field]);

  return {
    ...(differs('title') && target.title !== null && { title: target.title }),
    ...(differs('description') &&
      target.description !== null && { description: target.description }),
    ...(differs('tags') && { tags: [...target.tags] }),
    ...(differs('categoryId') && { categoryId: target.categoryId }),
    ...(differs('visibility') && { visibility: target.visibility }),
    ...(differs('thumbnail') && { selectedThumbnail: target.thumbnail }),
    ...(differs('chapters') && { chapters: target.chapters.map((chapter) => ({ ...chapter })) }),
    ...(differs('commentsEnabled') && { commentsEnabled: target.commentsEnabled }),
  };
}
