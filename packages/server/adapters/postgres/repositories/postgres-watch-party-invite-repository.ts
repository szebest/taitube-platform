import type {
  InviteWrite,
  NewOutboxInput,
  WatchPartyInviteRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyInvite } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { watchPartyInvites: inv, outbox } = schema;

export class PostgresWatchPartyInviteRepository implements WatchPartyInviteRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    invite: WatchPartyInvite,
    notify: NewOutboxInput
  ): Promise<Result<InviteWrite, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<InviteWrite> => {
          const [inserted] = await tx
            .insert(inv)
            .values(invite)
            .onConflictDoNothing({ target: [inv.roomId, inv.inviteeId] })
            .returning();
          if (inserted) return await this.sent(tx, inserted, notify);

          const [renewed] = await tx
            .update(inv)
            .set({
              inviterId: invite.inviterId,
              watching: invite.watching,
              expiresAt: invite.expiresAt,
            })
            .where(
              and(
                eq(inv.roomId, invite.roomId),
                eq(inv.inviteeId, invite.inviteeId),
                eq(inv.status, 'pending'),
                gt(inv.expiresAt, invite.createdAt)
              )
            )
            .returning();
          if (renewed) return { type: 'folded', invite: renewed };

          const [replaced] = await tx
            .insert(inv)
            .values(invite)
            .onConflictDoUpdate({
              target: [inv.roomId, inv.inviteeId],
              set: {
                id: invite.id,
                inviterId: invite.inviterId,
                status: invite.status,
                watching: invite.watching,
                expiresAt: invite.expiresAt,
                createdAt: invite.createdAt,
              },
            })
            .returning();
          return await this.sent(tx, replaced ?? invite, notify);
        }),
      databaseUnavailable.during('createWatchPartyInvite')
    );
  }

  async findById(id: string): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(inv).where(eq(inv.id, id)),
      databaseUnavailable.during('findWatchPartyInvite')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async findValid(
    roomId: string,
    inviteeId: string,
    now: Date
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(inv)
          .where(
            and(
              eq(inv.roomId, roomId),
              eq(inv.inviteeId, inviteeId),
              eq(inv.status, 'pending'),
              gt(inv.expiresAt, now)
            )
          ),
      databaseUnavailable.during('findValidWatchPartyInvite')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async listForRoom(roomId: string): Promise<Result<WatchPartyInvite[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(inv)
          .where(
            and(eq(inv.roomId, roomId), inArray(inv.status, ['pending', 'declined', 'joined']))
          )
          .orderBy(desc(inv.createdAt), desc(inv.id)),
      databaseUnavailable.during('listWatchPartyInvites')
    );
  }

  async countPending(roomId: string, now: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ pending: count() })
          .from(inv)
          .where(and(eq(inv.roomId, roomId), eq(inv.status, 'pending'), gt(inv.expiresAt, now))),
      databaseUnavailable.during('countPendingWatchPartyInvites')
    );
    return map(rows, ([row]) => row?.pending ?? 0);
  }

  async revoke(roomId: string, inviteId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(inv)
          .set({ status: 'revoked' })
          .where(and(eq(inv.id, inviteId), eq(inv.roomId, roomId), eq(inv.status, 'pending')))
          .returning({ id: inv.id }),
      databaseUnavailable.during('revokeWatchPartyInvite')
    );
    return map(rows, (changed) => changed.length > 0);
  }

  async decline(
    inviteeId: string,
    inviteId: string
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(inv)
          .set({ status: 'declined' })
          .where(and(eq(inv.id, inviteId), eq(inv.inviteeId, inviteeId), eq(inv.status, 'pending')))
          .returning(),
      databaseUnavailable.during('declineWatchPartyInvite')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async markJoined(inviteId: string): Promise<Result<void, DatabaseUnavailable>> {
    const updated = await fromPromise(
      () => this.db.update(inv).set({ status: 'joined' }).where(eq(inv.id, inviteId)),
      databaseUnavailable.during('markWatchPartyInviteJoined')
    );
    return map(updated, () => undefined);
  }

  private async sent(
    tx: PostgresDatabase,
    invite: WatchPartyInvite,
    notify: NewOutboxInput
  ): Promise<InviteWrite> {
    await tx.insert(outbox).values({
      id: notify.id || sql`gen_random_uuid()`,
      kind: notify.kind,
      payload: notify.payload,
      createdAt: new Date(),
      attempts: 0,
    });
    return { type: 'sent', invite };
  }
}
