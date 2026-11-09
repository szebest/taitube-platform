import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, map, type Result } from '@vp/result';

type ChatResume = 'fresh' | 'replayed' | 'expired';

export interface ChatBacklog<M> {
  resume: ChatResume;
  /** Lines a replayed client may still show that a moderator removed while it was away. */
  removed: string[];
  lines: M[];
}

/** A stream's chat or a room's: lines after a cursor, and the ones removed since it. */
interface ChatLines<M> {
  listAfter(
    id: string,
    after: string | null,
    limit: number
  ): Promise<Result<M[], DatabaseUnavailable>>;
  listRemovedSince(
    id: string,
    after: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>>;
}

/**
 * What a joining socket is sent first: every line after its cursor while there are at most `limit`,
 * else, as with no cursor, the latest `limit`.
 */
export async function readChatBacklog<M>(
  source: ChatLines<M>,
  id: string,
  after: string | null,
  limit: number
): Promise<Result<ChatBacklog<M>, DatabaseUnavailable>> {
  const latest = async (resume: 'fresh' | 'expired') =>
    map(await source.listAfter(id, null, limit), (lines) => ({
      resume,
      removed: [],
      lines,
    }));
  if (after === null) return latest('fresh');

  const missed = await source.listAfter(id, after, limit + 1);
  if (isErr(missed)) return missed;
  if (missed.value.length > limit) return latest('expired');
  return map(await source.listRemovedSince(id, after, limit), (removed) => ({
    resume: 'replayed' as const,
    removed,
    lines: missed.value,
  }));
}
