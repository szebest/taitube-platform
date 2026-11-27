import type { ListAuthoredCommentsOptions } from '@vp/core/repositories';
import { type AuthoredComment, commentVideoId } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { compareKeys, newestAfter, rowKey } from './comment-order';
import { toAuthoredCommentOf } from './comment-projections';
import type { StoredComment } from './comment-visibility';
import { keepWatchable, type VideoLookups } from './watchable-video';

/** The viewer's own standing comments on videos, newest first, on videos they may still watch. */
export async function listAuthored(
  lookups: VideoLookups,
  standing: readonly StoredComment[],
  viewer: UserContext,
  { cursor, limit }: ListAuthoredCommentsOptions
): Promise<AuthoredComment[]> {
  const mine = standing
    .filter((row) => row.authorId === viewer.id)
    .flatMap((row) => {
      const videoId = commentVideoId(row.target);
      return videoId === null ? [] : [{ ...row, videoId }];
    })
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));

  const kept = await keepWatchable(lookups, viewer, newestAfter(mine, cursor), limit);
  return kept.map(({ video, ...comment }) => toAuthoredCommentOf(comment, video));
}
