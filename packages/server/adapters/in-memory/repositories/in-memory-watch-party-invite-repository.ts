import type {
  InviteWrite,
  NewOutboxInput,
  OutboxRepository,
  WatchPartyInviteRepositoryPort,
} from '@vp/core/repositories';
import type { WatchPartyInvite } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { map, ok, type Result } from '@vp/result';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

const LISTED: readonly WatchPartyInvite['status'][] = ['pending', 'declined', 'joined'];

const isValid = (invite: WatchPartyInvite, now: Date) =>
  invite.status === 'pending' && invite.expiresAt.getTime() > now.getTime();

export class InMemoryWatchPartyInviteRepository implements WatchPartyInviteRepositoryPort {
  constructor(
    private readonly store: InMemoryWatchPartyStore,
    private readonly outbox: Pick<OutboxRepository, 'enqueue'>
  ) {}

  async create(
    invite: WatchPartyInvite,
    notify: NewOutboxInput
  ): Promise<Result<InviteWrite, DatabaseUnavailable>> {
    const existing = this.forPair(invite.roomId, invite.inviteeId);
    if (existing && isValid(existing, invite.createdAt)) {
      const renewed: WatchPartyInvite = {
        ...existing,
        inviterId: invite.inviterId,
        watching: invite.watching,
        expiresAt: invite.expiresAt,
      };
      this.store.invites.set(renewed.id, renewed);
      return ok({ type: 'folded', invite: { ...renewed } });
    }
    const queued = await this.outbox.enqueue(notify);
    return map(queued, () => {
      if (existing) this.store.invites.delete(existing.id);
      this.store.invites.set(invite.id, { ...invite });
      return { type: 'sent', invite: { ...invite } };
    });
  }

  async findById(id: string): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const invite = this.store.invites.get(id);
    return ok(invite ? { ...invite } : null);
  }

  async findValid(
    roomId: string,
    inviteeId: string,
    now: Date
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const invite = this.forPair(roomId, inviteeId);
    return ok(invite && isValid(invite, now) ? { ...invite } : null);
  }

  async listForRoom(roomId: string): Promise<Result<WatchPartyInvite[], DatabaseUnavailable>> {
    const listed = [...this.store.invites.values()]
      .filter((invite) => invite.roomId === roomId && LISTED.includes(invite.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    return ok(listed.map((invite) => ({ ...invite })));
  }

  async countPending(roomId: string, now: Date): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      [...this.store.invites.values()].filter(
        (invite) => invite.roomId === roomId && isValid(invite, now)
      ).length
    );
  }

  async revoke(roomId: string, inviteId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const invite = this.store.invites.get(inviteId);
    if (invite?.roomId !== roomId || invite.status !== 'pending') return ok(false);
    this.store.invites.set(inviteId, { ...invite, status: 'revoked' });
    return ok(true);
  }

  async decline(
    inviteeId: string,
    inviteId: string
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>> {
    const invite = this.store.invites.get(inviteId);
    if (invite?.inviteeId !== inviteeId || invite.status !== 'pending') return ok(null);
    const declined: WatchPartyInvite = { ...invite, status: 'declined' };
    this.store.invites.set(inviteId, declined);
    return ok({ ...declined });
  }

  async markJoined(inviteId: string): Promise<Result<void, DatabaseUnavailable>> {
    const invite = this.store.invites.get(inviteId);
    if (invite) this.store.invites.set(inviteId, { ...invite, status: 'joined' });
    return ok(undefined);
  }

  clear(): void {
    this.store.clear();
  }

  private forPair(roomId: string, inviteeId: string): WatchPartyInvite | undefined {
    return [...this.store.invites.values()].find(
      (invite) => invite.roomId === roomId && invite.inviteeId === inviteeId
    );
  }
}
