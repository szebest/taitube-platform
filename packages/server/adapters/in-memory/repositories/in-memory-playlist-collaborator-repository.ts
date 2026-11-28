import { type Result, isErr, ok } from '@kit/result';
import type {
  AcceptInvitePlan,
  OutboxRepository,
  PlaylistCollaboratorRepositoryPort,
  PlaylistSeatGrant,
} from '@vp/core/repositories';
import {
  type PlaylistActivityEntry,
  type PlaylistCollaborator,
  type PlaylistCollaboratorRole,
  type PlaylistInvite,
  autoRemoveStopped,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { playlistInviteOutbox } from '@vp/job-contracts';
import type { Clock } from './clock';
import type { InMemoryPlaylistActivityRepository } from './in-memory-playlist-activity-repository';

export interface InMemoryPlaylistCollaboratorDeps {
  activity: Pick<InMemoryPlaylistActivityRepository, 'record'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
  /** The owner of a playlist, `null` once it is gone. */
  ownerOf: (playlistId: string) => string | null;
  /** Ends removing watched videos on a list someone joins; answers whether it was on. */
  stopAutoRemove: (playlistId: string) => boolean;
  now: Clock;
}

export class InMemoryPlaylistCollaboratorRepository implements PlaylistCollaboratorRepositoryPort {
  private rows: PlaylistCollaborator[] = [];
  private readonly invites = new Map<string, PlaylistInvite>();

  constructor(private readonly deps: InMemoryPlaylistCollaboratorDeps) {}

  seatOf(playlistId: string, userId: string | null): PlaylistCollaboratorRole | null {
    return (
      this.rows.find((seat) => seat.playlistId === playlistId && seat.userId === userId)?.role ??
      null
    );
  }

  userIdsOn(playlistId: string): string[] {
    return this.rows.filter((seat) => seat.playlistId === playlistId).map((seat) => seat.userId);
  }

  /** Records a change on behalf of every write: the playlist repository logs through this too. */
  async record(
    playlistId: string,
    actorId: string,
    entries: readonly PlaylistActivityEntry[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    const ownerId = this.deps.ownerOf(playlistId);
    if (ownerId === null) return ok();
    return await this.deps.activity.record(playlistId, actorId, entries, {
      ownerId,
      collaboratorIds: this.userIdsOn(playlistId),
    });
  }

  async list(playlistId: string): Promise<Result<PlaylistCollaborator[], DatabaseUnavailable>> {
    return ok(this.rows.filter((seat) => seat.playlistId === playlistId));
  }

  async seats(
    playlistId: string,
    userId: string | null
  ): Promise<Result<{ seated: number; isCollaborator: boolean }, DatabaseUnavailable>> {
    return ok({
      seated: this.userIdsOn(playlistId).length,
      isCollaborator: this.seatOf(playlistId, userId) !== null,
    });
  }

  async createInvite(invite: PlaylistInvite): Promise<Result<PlaylistInvite, DatabaseUnavailable>> {
    if (invite.inviteeUserId !== null) {
      for (const [id, held] of this.invites) {
        if (held.playlistId === invite.playlistId && held.inviteeUserId === invite.inviteeUserId) {
          this.invites.delete(id);
        }
      }
    }
    this.invites.set(invite.id, { ...invite });
    if (invite.inviteeUserId === null) return ok({ ...invite });
    const queued = await this.deps.outbox.enqueue(playlistInviteOutbox({ inviteId: invite.id }));
    return isErr(queued) ? queued : ok({ ...invite });
  }

  async listInvites(playlistId: string): Promise<Result<PlaylistInvite[], DatabaseUnavailable>> {
    return ok(
      [...this.invites.values()]
        .filter((invite) => invite.playlistId === playlistId && invite.revokedAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    );
  }

  async findInvite(token: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>> {
    return ok(this.byToken(token) ?? null);
  }

  async findInviteById(id: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>> {
    const invite = this.invites.get(id);
    return ok(invite ? { ...invite } : null);
  }

  async revokeInvite(
    playlistId: string,
    inviteId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.playlistId !== playlistId || invite.revokedAt !== null) return ok(false);
    this.invites.set(inviteId, { ...invite, revokedAt: at });
    return ok(true);
  }

  async deleteInvite(token: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const invite = this.byToken(token);
    if (!invite || invite.inviteeUserId === null) return ok(false);
    return ok(this.invites.delete(invite.id));
  }

  async accept<F>(
    token: string,
    userId: string,
    plan: AcceptInvitePlan<F>
  ): Promise<Result<PlaylistSeatGrant, DatabaseUnavailable | F>> {
    const invite = this.byToken(token);
    const ownerId = invite ? this.deps.ownerOf(invite.playlistId) : null;
    const owned = invite && ownerId !== null ? { ...invite, ownerId } : null;
    const decided = plan({
      invite: owned,
      seated: owned ? this.userIdsOn(owned.playlistId).length : 0,
      isCollaborator: owned ? this.seatOf(owned.playlistId, userId) !== null : false,
    });
    if (isErr(decided) || !invite) return decided;

    const { playlistId, role } = decided.value;
    this.rows.push({
      playlistId,
      userId,
      role,
      addedBy: invite.createdBy,
      createdAt: new Date(this.deps.now()),
    });
    this.invites.set(invite.id, { ...invite, useCount: invite.useCount + 1 });
    const stopped = this.deps.stopAutoRemove(playlistId);
    const logged = await this.record(playlistId, userId, [
      { action: 'collaborator_added', target: { userId, role } },
      ...(stopped ? [autoRemoveStopped()] : []),
    ]);
    return isErr(logged) ? logged : ok(decided.value);
  }

  async changeRole(
    playlistId: string,
    userId: string,
    role: PlaylistCollaboratorRole,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (this.seatOf(playlistId, userId) === null) return ok(false);
    this.rows = this.rows.map((seat) =>
      seat.playlistId === playlistId && seat.userId === userId ? { ...seat, role } : seat
    );
    const logged = await this.record(playlistId, actorId, [
      { action: 'role_changed', target: { userId, role } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async remove(
    playlistId: string,
    userId: string,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (this.seatOf(playlistId, userId) === null) return ok(false);
    this.rows = this.rows.filter(
      (seat) => !(seat.playlistId === playlistId && seat.userId === userId)
    );
    const logged = await this.record(playlistId, actorId, [
      { action: 'collaborator_removed', target: { userId } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  /** A deleted playlist takes its seats and invites, as the foreign keys do in postgres. */
  forget(playlistId: string): void {
    this.rows = this.rows.filter((seat) => seat.playlistId !== playlistId);
    for (const [id, invite] of this.invites) {
      if (invite.playlistId === playlistId) this.invites.delete(id);
    }
  }

  clear(): void {
    this.rows = [];
    this.invites.clear();
  }

  private byToken(token: string): PlaylistInvite | undefined {
    const invite = [...this.invites.values()].find((held) => held.token === token);
    return invite && { ...invite };
  }
}
