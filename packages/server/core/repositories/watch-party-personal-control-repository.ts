import type { Result } from '@kit/result';
import type { PersonalControlRecord } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface WatchPartyPersonalControlRepositoryPort {
  /** Every everywhere control, and with a room its room-scoped ones too. */
  list(
    userId: string,
    roomId: string | null
  ): Promise<Result<PersonalControlRecord[], DatabaseUnavailable>>;
  /** Upserts by user, target and scope; a control that chooses nothing deletes the row. */
  put(record: PersonalControlRecord): Promise<Result<void, DatabaseUnavailable>>;
  /** Of `userIds`, those who block invites from `inviterKey` everywhere. */
  blockingInvitesFrom(
    inviterKey: string,
    userIds: readonly string[]
  ): Promise<Result<Set<string>, DatabaseUnavailable>>;
}
