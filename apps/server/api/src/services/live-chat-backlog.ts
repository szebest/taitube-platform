import type { LiveChatRepositoryPort } from '@vp/core/repositories';
import type { LiveChatMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, map, ok, type Result } from '@vp/result';

export type LiveChatResume = 'fresh' | 'replayed' | 'expired';

/**
 * What a joining socket is sent first: every line after its cursor while there are at most `limit`,
 * else, as with no cursor, the latest `limit`.
 */
export async function readLiveChatBacklog(
  liveChat: Pick<LiveChatRepositoryPort, 'listAfter'>,
  liveStreamId: string,
  after: string | null,
  limit: number
): Promise<Result<{ resume: LiveChatResume; lines: LiveChatMessage[] }, DatabaseUnavailable>> {
  if (after === null) {
    return map(await liveChat.listAfter(liveStreamId, null, limit), (lines) => ({
      resume: 'fresh' as const,
      lines,
    }));
  }

  const missed = await liveChat.listAfter(liveStreamId, after, limit + 1);
  if (isErr(missed)) return missed;
  if (missed.value.length <= limit) return ok({ resume: 'replayed', lines: missed.value });
  return map(await liveChat.listAfter(liveStreamId, null, limit), (lines) => ({
    resume: 'expired' as const,
    lines,
  }));
}
