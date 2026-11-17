import type { Result } from '@kit/result';
import type { WatchPartyInviteLink } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface WatchPartyInviteLinkRepositoryPort {
  create(link: WatchPartyInviteLink): Promise<Result<WatchPartyInviteLink, DatabaseUnavailable>>;
  findByTokenHash(
    tokenHash: string
  ): Promise<Result<WatchPartyInviteLink | null, DatabaseUnavailable>>;
  /** One compare-and-set: unrevoked, unexpired and under `max_uses`, then one more use. */
  use(linkId: string, now: Date): Promise<Result<boolean, DatabaseUnavailable>>;
  list(roomId: string): Promise<Result<WatchPartyInviteLink[], DatabaseUnavailable>>;
  revoke(roomId: string, linkId: string, at: Date): Promise<Result<boolean, DatabaseUnavailable>>;
}
