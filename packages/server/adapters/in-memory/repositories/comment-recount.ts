import type { Video } from '@vp/domain';
import { isVisibleTo, type PublicScopeContext } from './comment-public-scope';
import { standing, type StoredComment } from './comment-visibility';

/**
 * The videos of `ownerVideos` the user commented on, each with `commentsCount` set to what an
 * anonymous reader sees: the in-memory form of the postgres recount a restriction runs.
 */
export function recountAuthored(
  comments: ReadonlyMap<string, StoredComment>,
  ownerVideos: readonly Pick<Video, 'id' | 'commentsCount'>[],
  userId: string,
  scope: PublicScopeContext
): string[] {
  const live = standing(comments.values());
  const touched = ownerVideos.filter((video) =>
    live.some((row) => row.videoId === video.id && row.authorId === userId)
  );
  for (const video of touched) {
    video.commentsCount = live.filter(
      (row) => row.videoId === video.id && isVisibleTo(null, row, scope)
    ).length;
  }
  return touched.map(({ id }) => id);
}
