import type { WatchPartyPersonalControlRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { isNoPersonalControl, type PersonalControlRecord, partyControlsUpdated } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { watchPartyPersonalControls: pc } = schema;

export class PostgresWatchPartyPersonalControlRepository implements WatchPartyPersonalControlRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(
    userId: string,
    roomId: string | null
  ): Promise<Result<PersonalControlRecord[], DatabaseUnavailable>> {
    const scope =
      roomId === null ? isNull(pc.roomId) : or(isNull(pc.roomId), eq(pc.roomId, roomId));
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(pc)
          .where(and(eq(pc.userId, userId), scope)),
      databaseUnavailable.during('listWatchPartyPersonalControls')
    );
  }

  async put(record: PersonalControlRecord): Promise<Result<void, DatabaseUnavailable>> {
    const { userId, targetKey, roomId, ...values } = record;
    const written = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (isNoPersonalControl(record)) {
            await tx
              .delete(pc)
              .where(
                and(
                  eq(pc.userId, userId),
                  eq(pc.targetKey, targetKey),
                  roomId === null ? isNull(pc.roomId) : eq(pc.roomId, roomId)
                )
              );
          } else {
            await tx
              .insert(pc)
              .values(record)
              .onConflictDoUpdate({ target: [pc.userId, pc.targetKey, pc.roomId], set: values });
          }
          await appendUserEvent(tx, { userId, ...partyControlsUpdated(targetKey, roomId) });
        }),
      databaseUnavailable.during('putWatchPartyPersonalControl')
    );
    return map(written, () => undefined);
  }

  async blockingInvitesFrom(
    inviterKey: string,
    userIds: readonly string[]
  ): Promise<Result<Set<string>, DatabaseUnavailable>> {
    if (userIds.length === 0) return ok(new Set());
    const rows = await fromPromise(
      () =>
        this.db
          .select({ userId: pc.userId })
          .from(pc)
          .where(
            and(
              inArray(pc.userId, [...userIds]),
              eq(pc.targetKey, inviterKey),
              isNull(pc.roomId),
              eq(pc.blockInvites, true)
            )
          ),
      databaseUnavailable.during('listWatchPartyInviteBlockers')
    );
    return map(rows, (found) => new Set(found.map(({ userId }) => userId)));
  }
}
