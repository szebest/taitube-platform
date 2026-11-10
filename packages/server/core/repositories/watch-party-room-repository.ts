import type {
  WatchPartyCloseReason,
  WatchPartyMember,
  WatchPartyPlayback,
  WatchPartyQueueItem,
  WatchPartyRoleRecord,
  WatchPartyRoom,
  WatchPartySettings,
  WatchPartySystemLine,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** A system line written in the transaction of its cause, so a reconnect replays it. */
export interface NewSystemLine {
  readonly id: string;
  readonly line: WatchPartySystemLine;
  readonly videoId: string | null;
  readonly positionMs: number | null;
  readonly createdAt: Date;
}

type NewWatchPartyRoom = Pick<
  WatchPartyRoom,
  | 'id'
  | 'ownerKey'
  | 'asChannelId'
  | 'passwordHash'
  | 'playback'
  | 'permissionsVersion'
  | 'createdAt'
> &
  WatchPartySettings;

export type NewWatchPartyMember = Omit<WatchPartyMember, 'leftAt'>;

export type NewWatchPartyQueueItem = Omit<
  WatchPartyQueueItem,
  'position' | 'playedAt' | 'removedAt'
>;

/** Everything a room starts with, written in one transaction. */
export interface WatchPartyRoomSeed {
  readonly room: NewWatchPartyRoom;
  readonly roles: readonly Omit<WatchPartyRoleRecord, 'roomId' | 'createdAt' | 'updatedAt'>[];
  readonly owner: NewWatchPartyMember;
  /** In play order; the first is the lobby's item. */
  readonly queue: readonly NewWatchPartyQueueItem[];
}

export type SettingsPatch = Partial<WatchPartySettings> & { readonly passwordHash?: string | null };

export type RoomWrite<T = WatchPartyRoom> =
  | { readonly type: 'applied'; readonly room: T }
  | { readonly type: 'stale'; readonly room: WatchPartyRoom }
  | { readonly type: 'missing' };

export interface PlaybackChange {
  /** Both fencing tokens the command saw: a newer state or a role change since makes it stale. */
  readonly expected: { readonly playbackVersion: number; readonly rolesVersion: number };
  readonly playback: WatchPartyPlayback;
  /** Set on an advance: the item the room moved off, now played. */
  readonly playedItemId?: string;
  readonly currentVideoId?: string | null;
  readonly line: NewSystemLine | null;
  readonly at: Date;
}

export interface OwnerTransfer {
  readonly fromKey: string;
  readonly toKey: string;
  readonly expectedRolesVersion: number;
  /** The previous owner holds Co-host from then on. */
  readonly cohostRoleId: string;
  readonly line: NewSystemLine;
  readonly at: Date;
}

export interface WatchPartyRoomRepositoryPort {
  create(seed: WatchPartyRoomSeed): Promise<Result<WatchPartyRoom, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<WatchPartyRoom | null, DatabaseUnavailable>>;
  countOpenOwnedBy(ownerKey: string): Promise<Result<number, DatabaseUnavailable>>;
  /** The owner's open rooms, newest first. */
  listOpenOwnedBy(ownerKey: string): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>>;
  /** Optimistic on `version`: a stale one is `stale` with the current room. */
  updateSettings(
    id: string,
    patch: SettingsPatch,
    expectedVersion: number,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>>;
  /** One compare-and-set on `playback_version` and `roles_version`; the phase column follows. */
  commitPlayback(
    id: string,
    change: PlaybackChange
  ): Promise<Result<RoomWrite, DatabaseUnavailable>>;
  /** `stale` when it was already closed. */
  close(
    id: string,
    reason: WatchPartyCloseReason,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>>;
  /** The count the poller and discovery read; `last_present_at` moves only while someone is there. */
  recordPresence(id: string, present: number, at: Date): Promise<Result<void, DatabaseUnavailable>>;
  transferOwner(
    id: string,
    transfer: OwnerTransfer
  ): Promise<Result<RoomWrite, DatabaseUnavailable>>;
  /**
   * Writes the upgraded built-in roles' permissions and the new registry version, only while the
   * room is still at `fromVersion`, so two pods loading it at once upgrade it once.
   */
  upgradeRoles(
    id: string,
    roles: readonly { readonly id: string; readonly permissions: readonly string[] }[],
    fromVersion: number,
    toVersion: number
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
