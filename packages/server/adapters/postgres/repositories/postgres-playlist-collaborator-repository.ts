import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, andThen, fromPromise, isErr, map, ok } from '@kit/result';
import type {
  AcceptInvitePlan,
  PlaylistCollaboratorRepositoryPort,
  PlaylistSeatGrant,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type PlaylistCollaborator,
  type PlaylistCollaboratorRole,
  type PlaylistInvite,
  autoRemoveStopped,
} from '@vp/domain';
import { playlistInviteOutbox } from '@vp/job-contracts';
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { enqueueNotificationJobs } from './notification-jobs';
import { recordPlaylistChange } from './playlist-change';
import { lockPlaylist } from './playlist-item-writes';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistCollaborators: pc, playlistInvites: inv } = schema;

export class PostgresPlaylistCollaboratorRepository implements PlaylistCollaboratorRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(playlistId: string): Promise<Result<PlaylistCollaborator[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(pc)
          .where(eq(pc.playlistId, playlistId))
          .orderBy(asc(pc.createdAt), asc(pc.userId)),
      databaseUnavailable.during('listPlaylistCollaborators')
    );
  }

  async seats(
    playlistId: string,
    userId: string | null
  ): Promise<Result<{ seated: number; isCollaborator: boolean }, DatabaseUnavailable>> {
    return await fromPromise(
      () => seatsOf(this.db, playlistId, userId),
      databaseUnavailable.during('countPlaylistSeats')
    );
  }

  async createInvite(invite: PlaylistInvite): Promise<Result<PlaylistInvite, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const insert = tx.insert(inv).values(invite);
          const [row] =
            invite.inviteeUserId === null
              ? await insert.returning()
              : await insert
                  .onConflictDoUpdate({
                    target: [inv.playlistId, inv.inviteeUserId],
                    targetWhere: isNotNull(inv.inviteeUserId),
                    set: {
                      id: invite.id,
                      role: invite.role,
                      token: invite.token,
                      createdBy: invite.createdBy,
                      expiresAt: invite.expiresAt,
                      useCount: 0,
                      revokedAt: null,
                      createdAt: invite.createdAt,
                    },
                  })
                  .returning();
          if (!row) throw new Error('playlist_invites insert returned no row');
          if (row.inviteeUserId !== null) {
            await enqueueNotificationJobs(tx, [playlistInviteOutbox({ inviteId: row.id })]);
          }
          return row;
        }),
      databaseUnavailable.during('createPlaylistInvite')
    );
  }

  async listInvites(playlistId: string): Promise<Result<PlaylistInvite[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(inv)
          .where(and(eq(inv.playlistId, playlistId), isNull(inv.revokedAt)))
          .orderBy(desc(inv.createdAt), desc(inv.id)),
      databaseUnavailable.during('listPlaylistInvites')
    );
  }

  async findInvite(token: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(inv).where(eq(inv.token, token)),
      databaseUnavailable.during('findPlaylistInvite')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async findInviteById(id: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(inv).where(eq(inv.id, id)),
      databaseUnavailable.during('findPlaylistInvite')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async revokeInvite(
    playlistId: string,
    inviteId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(inv)
          .set({ revokedAt: at })
          .where(and(eq(inv.playlistId, playlistId), eq(inv.id, inviteId), isNull(inv.revokedAt)))
          .returning({ id: inv.id }),
      databaseUnavailable.during('revokePlaylistInvite')
    );
    return map(rows, (revoked) => revoked.length > 0);
  }

  async deleteInvite(token: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(inv)
          .where(and(eq(inv.token, token), isNotNull(inv.inviteeUserId)))
          .returning({ id: inv.id }),
      databaseUnavailable.during('declinePlaylistInvite')
    );
    return map(rows, (deleted) => deleted.length > 0);
  }

  async accept<F>(
    token: string,
    userId: string,
    plan: AcceptInvitePlan<F>
  ): Promise<Result<PlaylistSeatGrant, DatabaseUnavailable | F>> {
    const outcome = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<Result<PlaylistSeatGrant, F>> => {
          const [invite] = await tx
            .select({ invite: inv, ownerId: p.ownerId })
            .from(inv)
            .innerJoin(p, eq(p.id, inv.playlistId))
            .where(eq(inv.token, token))
            .for('update');
          if (invite) await lockPlaylist(tx, invite.invite.playlistId);
          const seats = invite
            ? await seatsOf(tx, invite.invite.playlistId, userId)
            : { seated: 0, isCollaborator: false };
          const decided = plan({
            invite: invite ? { ...invite.invite, ownerId: invite.ownerId } : null,
            ...seats,
          });
          if (isErr(decided) || !invite) return decided;

          const { playlistId, role } = decided.value;
          await tx
            .insert(pc)
            .values({ playlistId, userId, role, addedBy: invite.invite.createdBy });
          await tx
            .update(inv)
            .set({ useCount: sql`${inv.useCount} + 1` })
            .where(eq(inv.id, invite.invite.id));
          const stopped = await tx
            .update(p)
            .set({ autoRemoveWatched: false })
            .where(and(eq(p.id, playlistId), eq(p.autoRemoveWatched, true)))
            .returning({ id: p.id });
          await recordPlaylistChange(tx, playlistId, userId, [
            { action: 'collaborator_added', target: { userId, role } },
            ...(stopped.length > 0 ? [autoRemoveStopped()] : []),
          ]);
          return ok(decided.value);
        }),
      databaseUnavailable.during('acceptPlaylistInvite')
    );
    return andThen(outcome, (decided) => decided);
  }

  async changeRole(
    playlistId: string,
    userId: string,
    role: PlaylistCollaboratorRole,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const changed = await tx
            .update(pc)
            .set({ role })
            .where(and(eq(pc.playlistId, playlistId), eq(pc.userId, userId)))
            .returning({ userId: pc.userId });
          if (changed.length === 0) return false;
          await recordPlaylistChange(tx, playlistId, actorId, [
            { action: 'role_changed', target: { userId, role } },
          ]);
          return true;
        }),
      databaseUnavailable.during('changePlaylistRole')
    );
  }

  async remove(
    playlistId: string,
    userId: string,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const removed = await tx
            .delete(pc)
            .where(and(eq(pc.playlistId, playlistId), eq(pc.userId, userId)))
            .returning({ userId: pc.userId });
          if (removed.length === 0) return false;
          await recordPlaylistChange(tx, playlistId, actorId, [
            { action: 'collaborator_removed', target: { userId } },
          ]);
          return true;
        }),
      databaseUnavailable.during('removePlaylistCollaborator')
    );
  }
}

async function seatsOf(
  db: PostgresDatabase,
  playlistId: string,
  userId: string | null
): Promise<{ seated: number; isCollaborator: boolean }> {
  const [row] = await db
    .select({
      seated: count(),
      mine: sql<number>`count(*) filter (where ${pc.userId} = ${userId})`.mapWith(Number),
    })
    .from(pc)
    .where(eq(pc.playlistId, playlistId));
  return { seated: row?.seated ?? 0, isCollaborator: (row?.mine ?? 0) > 0 };
}
