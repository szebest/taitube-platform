import type { WatchPartyInviteLinkRepositoryPort } from '@vp/core/repositories';
import type { WatchPartyInviteLink } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

export class InMemoryWatchPartyInviteLinkRepository implements WatchPartyInviteLinkRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async create(
    link: WatchPartyInviteLink
  ): Promise<Result<WatchPartyInviteLink, DatabaseUnavailable>> {
    this.store.inviteLinks.set(link.id, { ...link });
    return ok({ ...link });
  }

  async findByTokenHash(
    tokenHash: string
  ): Promise<Result<WatchPartyInviteLink | null, DatabaseUnavailable>> {
    const link = [...this.store.inviteLinks.values()].find((each) => each.tokenHash === tokenHash);
    return ok(link ? { ...link } : null);
  }

  async use(linkId: string, now: Date): Promise<Result<boolean, DatabaseUnavailable>> {
    const link = this.store.inviteLinks.get(linkId);
    const usable =
      link !== undefined &&
      link.revokedAt === null &&
      link.expiresAt.getTime() > now.getTime() &&
      (link.maxUses === null || link.uses < link.maxUses);
    if (!usable) return ok(false);
    this.store.inviteLinks.set(linkId, { ...link, uses: link.uses + 1 });
    return ok(true);
  }

  async list(roomId: string): Promise<Result<WatchPartyInviteLink[], DatabaseUnavailable>> {
    const listed = [...this.store.inviteLinks.values()]
      .filter((link) => link.roomId === roomId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    return ok(listed.map((link) => ({ ...link })));
  }

  async revoke(
    roomId: string,
    linkId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const link = this.store.inviteLinks.get(linkId);
    if (link?.roomId !== roomId || link.revokedAt !== null) return ok(false);
    this.store.inviteLinks.set(linkId, { ...link, revokedAt: at });
    return ok(true);
  }

  clear(): void {
    this.store.clear();
  }
}
