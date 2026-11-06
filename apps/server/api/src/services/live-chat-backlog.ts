import type { LiveChatRepositoryPort } from '@vp/core/repositories';
import type { LiveChatMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, map, type Result } from '@vp/result';

type LiveChatResume = 'fresh' | 'replayed' | 'expired';

export interface LiveChatBacklog {
  resume: LiveChatResume;
  /** Lines a replayed client may still show that a moderator removed while it was away. */
  removed: string[];
  lines: LiveChatMessage[];
}

/**
 * What a joining socket is sent first: every line after its cursor while there are at most `limit`,
 * else, as with no cursor, the latest `limit`.
 */
export async function readLiveChatBacklog(
  liveChat: Pick<LiveChatRepositoryPort, 'listAfter' | 'listRemovedSince'>,
  liveStreamId: string,
  after: string | null,
  limit: number
): Promise<Result<LiveChatBacklog, DatabaseUnavailable>> {
  const latest = async (resume: 'fresh' | 'expired') =>
    map(await liveChat.listAfter(liveStreamId, null, limit), (lines) => ({
      resume,
      removed: [],
      lines,
    }));
  if (after === null) return latest('fresh');

  const missed = await liveChat.listAfter(liveStreamId, after, limit + 1);
  if (isErr(missed)) return missed;
  if (missed.value.length > limit) return latest('expired');
  return map(await liveChat.listRemovedSince(liveStreamId, after, limit), (removed) => ({
    resume: 'replayed' as const,
    removed,
    lines: missed.value,
  }));
}
