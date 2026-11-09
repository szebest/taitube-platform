import type {
  ChannelUserRestrictionQuery,
  ChannelUserRestrictionRepositoryPort,
} from '@vp/core/repositories';
import {
  type ChannelUserRestriction,
  isRestrictionActive,
  type NewChannelUserRestriction,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

const keysetOf = ({ createdAt, userId }: ChannelUserRestriction) => ({
  sort: createdAt,
  tie: userId,
});

export class InMemoryChannelUserRestrictionRepository implements ChannelUserRestrictionRepositoryPort {
  private readonly rows = new Map<string, ChannelUserRestriction>();

  async findActive(
    channelId: string,
    userId: string,
    now: Date
  ): Promise<Result<ChannelUserRestriction | null, DatabaseUnavailable>> {
    const row = this.rows.get(keyOf(channelId, userId));
    return ok(row && isRestrictionActive(row, now) ? { ...row } : null);
  }

  async apply(
    restriction: NewChannelUserRestriction
  ): Promise<Result<ChannelUserRestriction, DatabaseUnavailable>> {
    const row = { ...restriction, createdAt: new Date() };
    this.rows.set(keyOf(row.channelId, row.userId), row);
    return ok({ ...row });
  }

  async lift(channelId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.rows.delete(keyOf(channelId, userId)));
  }

  async list(
    channelId: string,
    { cursor, limit, now }: ChannelUserRestrictionQuery
  ): Promise<Result<ChannelUserRestriction[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.userId };
    return ok(
      [...this.rows.values()]
        .filter(
          (row) =>
            row.channelId === channelId &&
            isRestrictionActive(row, now) &&
            isKeysetBefore(keysetOf(row), after)
        )
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  async purgeEndedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const ended = [...this.rows].filter(([, row]) => row.expiresAt && row.expiresAt < cutoff);
    for (const [key] of ended) this.rows.delete(key);
    return ok(ended.length);
  }

  /** The users a shadow ban hides on the channel; it never expires. */
  shadowedUserIds(channelId: string): Set<string> {
    return new Set(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId && row.kind === 'shadow')
        .map((row) => row.userId)
    );
  }

  clear(): void {
    this.rows.clear();
  }
}
