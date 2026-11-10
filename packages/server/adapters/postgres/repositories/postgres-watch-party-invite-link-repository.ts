import type { WatchPartyInviteLinkRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyInviteLink } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { watchPartyInviteLinks: links } = schema;

export class PostgresWatchPartyInviteLinkRepository implements WatchPartyInviteLinkRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    link: WatchPartyInviteLink
  ): Promise<Result<WatchPartyInviteLink, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () => this.db.insert(links).values(link),
      databaseUnavailable.during('createWatchPartyInviteLink')
    );
    return map(inserted, () => link);
  }

  async findByTokenHash(
    tokenHash: string
  ): Promise<Result<WatchPartyInviteLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(links).where(eq(links.tokenHash, tokenHash)),
      databaseUnavailable.during('findWatchPartyInviteLink')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async use(linkId: string, now: Date): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(links)
          .set({ uses: sql`${links.uses} + 1` })
          .where(
            and(
              eq(links.id, linkId),
              isNull(links.revokedAt),
              gt(links.expiresAt, now),
              or(isNull(links.maxUses), lt(links.uses, links.maxUses))
            )
          )
          .returning({ id: links.id }),
      databaseUnavailable.during('useWatchPartyInviteLink')
    );
    return map(rows, (counted) => counted.length > 0);
  }

  async list(roomId: string): Promise<Result<WatchPartyInviteLink[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(links)
          .where(eq(links.roomId, roomId))
          .orderBy(desc(links.createdAt), desc(links.id)),
      databaseUnavailable.during('listWatchPartyInviteLinks')
    );
  }

  async revoke(
    roomId: string,
    linkId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(links)
          .set({ revokedAt: at })
          .where(and(eq(links.id, linkId), eq(links.roomId, roomId), isNull(links.revokedAt)))
          .returning({ id: links.id }),
      databaseUnavailable.during('revokeWatchPartyInviteLink')
    );
    return map(rows, (revoked) => revoked.length > 0);
  }
}
