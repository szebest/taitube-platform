import type {
  ChannelUserRestrictionQuery,
  ChannelUserRestrictionRepositoryPort,
  OutboxRepository,
  RestrictionLifted,
  RestrictionWritten,
} from '@vp/core/repositories';
import {
  type ChannelUserRestriction,
  isRestrictionActive,
  type ModerationRecord,
  type NewChannelAuditEntry,
  type NewChannelUserRestriction,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import { recordModeration } from './comment-moderation-record';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

const keysetOf = ({ createdAt, userId }: ChannelUserRestriction) => ({
  sort: createdAt,
  tie: userId,
});

export interface InMemoryChannelUserRestrictionRepositoryOptions {
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
  /** Counts the user's comments again and answers the videos it touched. */
  recount: (channelId: string, userId: string) => Promise<string[]>;
}

export class InMemoryChannelUserRestrictionRepository implements ChannelUserRestrictionRepositoryPort {
  private readonly rows = new Map<string, ChannelUserRestriction>();

  constructor(private readonly deps: InMemoryChannelUserRestrictionRepositoryOptions) {}

  async findActive(
    channelId: string,
    userId: string,
    now: Date
  ): Promise<Result<ChannelUserRestriction | null, DatabaseUnavailable>> {
    const row = this.rows.get(keyOf(channelId, userId));
    return ok(row && isRestrictionActive(row, now) ? { ...row } : null);
  }

  async apply(
    restriction: NewChannelUserRestriction,
    record?: ModerationRecord
  ): Promise<Result<RestrictionWritten, DatabaseUnavailable>> {
    const row = { ...restriction, createdAt: new Date() };
    this.rows.set(keyOf(row.channelId, row.userId), row);
    const videoIds = await this.deps.recount(row.channelId, row.userId);
    const recorded = await recordModeration(this.deps, record);
    return isErr(recorded) ? recorded : ok({ restriction: { ...row }, videoIds });
  }

  async lift(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<RestrictionLifted, DatabaseUnavailable>> {
    if (!this.rows.delete(keyOf(channelId, userId))) return ok({ lifted: false, videoIds: [] });

    const videoIds = await this.deps.recount(channelId, userId);
    const recorded = await recordModeration(this.deps, audit && { audit });
    return isErr(recorded) ? recorded : ok({ lifted: true, videoIds });
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

  /** The users with a restriction on the channel that has not ended. */
  restrictedUserIds(channelId: string): Set<string> {
    const now = new Date();
    return new Set(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId && isRestrictionActive(row, now))
        .map((row) => row.userId)
    );
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
