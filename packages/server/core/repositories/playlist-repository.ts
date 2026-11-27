import type { Result } from '@kit/result';
import type {
  NewPlaylistInput,
  OwnedPlaylist,
  Playlist,
  PlaylistDetail,
  PlaylistEntry,
  PlaylistItemPatch,
  PlaylistItemSort,
  PlaylistPatch,
  PositionWrite,
  PublicPlaylist,
  ReorderSlot,
  RestorablePlaylistActivity,
  SeatedPlaylist,
  StoredPlaylistItem,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { ShareGrant, UserContext } from '@vp/permissions';

export type AddPlaylistItemOutcome = 'added' | 'present' | 'playlist-missing' | 'video-missing';

/** `addedBy` is who the list credits: the actor, or the original adder of a restored item. */
export interface NewPlaylistItem {
  id: string;
  videoId: string;
  addedBy: string | null;
  note?: string | null;
  startMs?: number | null;
  endMs?: number | null;
}

export interface NewPlaylistSection {
  id: string;
  title: string;
  addedBy: string;
}

export type PlaylistItemTarget = { by: 'item'; itemId: string } | { by: 'video'; videoId: string };

export type AppendItemOutcome = 'added' | 'present' | 'video-missing';

/** Each item's outcome by its id in the request; `null` when the target playlist is gone. */
export type TransferOutcome = Map<string, AppendItemOutcome | 'source-missing'> | null;

/** One source of a merge: what it hands over, and whether it goes once every item of it landed. */
export interface MergeSource {
  sourceId: string;
  items: readonly StoredPlaylistItem[];
  deleteIfLanded: boolean;
}

/** Each source's `TransferOutcome`; null when the target is gone. */
export type MergeOutcome = Map<string, NonNullable<TransferOutcome>> | null;

export type RestoreItemOutcome = 'restored' | 'present' | 'video-missing' | 'playlist-missing';

export interface ListPublicPlaylistsOptions {
  cursor: { updatedAt: Date; id: string } | null;
  limit: number;
}

/** The sort key of the last item of a page and its id, as the next page starts after it. */
export interface PlaylistItemCursor {
  key: string | number;
  id: string;
}

/** An item with the value its sort compares, for the cursor of the page it ends. */
export interface SortedPlaylistEntry {
  entry: PlaylistEntry;
  key: string | number;
}

export interface ListPlaylistItemsOptions {
  sort: PlaylistItemSort;
  cursor: PlaylistItemCursor | null;
  limit: number;
}

/** Decides the position writes from the slots as they stand inside the write transaction. */
export type ReorderPlan<F> = (slots: readonly ReorderSlot[]) => Result<PositionWrite[], F>;

/**
 * `findById` and `findSeated` are unscoped, for write decisions; every read a caller sees goes
 * through the viewer's read scope, so a private playlist and a video the viewer may not watch never
 * reach them. Item writes lock the playlist row, so concurrent appends and reorders serialise, and
 * each one logs its activity and tells the other people on the playlist in the same transaction.
 */
export interface PlaylistRepositoryPort {
  create(input: NewPlaylistInput): Promise<Result<Playlist, DatabaseUnavailable>>;
  /** Idempotent: an owner who already has their Watch Later keeps it. */
  provisionWatchLater(input: {
    id: string;
    ownerId: string;
  }): Promise<Result<void, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>>;
  /** The playlist with `userId`'s seat on it; an anonymous caller sits nowhere. */
  findSeated(
    id: string,
    userId: string | null
  ): Promise<Result<SeatedPlaylist | null, DatabaseUnavailable>>;
  /** `share` is a live link of this playlist, which lets the viewer read it whatever its visibility. */
  findDetail(
    id: string,
    viewer: UserContext | null,
    share?: ShareGrant | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>>;
  /** Watch Later first, then the most recently changed. */
  listOwned(
    owner: UserContext,
    videoId: string | null
  ): Promise<Result<OwnedPlaylist[], DatabaseUnavailable>>;
  /**
   * One owner's public playlists, most recently changed first, as an anonymous visitor sees them:
   * `videoCount` and `posterKeys` leave out what that visitor may not watch. Up to `limit + 1` rows.
   */
  listPublicByOwner(
    ownerId: string,
    options: ListPublicPlaylistsOptions
  ): Promise<Result<PublicPlaylist[], DatabaseUnavailable>>;
  /** Every item's video id and owner, whether or not any viewer may watch it. */
  listItemOwners(
    playlistId: string
  ): Promise<Result<{ id: string; ownerId: string }[], DatabaseUnavailable>>;
  /** The video items the viewer may watch, by `sort`, keyset-paged; up to `limit + 1`. */
  listItems(
    playlistId: string,
    viewer: UserContext | null,
    options: ListPlaylistItemsOptions
  ): Promise<Result<SortedPlaylistEntry[], DatabaseUnavailable>>;
  /** Every stored row, sections included, in playlist order; only `itemIds` when given. */
  findItems(
    playlistId: string,
    itemIds?: readonly string[]
  ): Promise<Result<StoredPlaylistItem[], DatabaseUnavailable>>;
  update(
    id: string,
    patch: PlaylistPatch,
    actorId: string
  ): Promise<Result<Playlist | null, DatabaseUnavailable>>;
  /** Never removes a system playlist; answers whether a row went. */
  remove(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Appends after the last item; adding a video the playlist holds is `present`, not an error. */
  addItem(
    playlistId: string,
    item: NewPlaylistItem,
    actorId: string
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>>;
  /** Appends in order, skipping videos held already; `null` when the playlist is gone. */
  appendItems(
    playlistId: string,
    items: readonly NewPlaylistItem[],
    actorId: string
  ): Promise<Result<Map<string, AppendItemOutcome> | null, DatabaseUnavailable>>;
  /** Answers whether a row went. */
  removeItem(
    playlistId: string,
    target: PlaylistItemTarget,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  editItem(
    playlistId: string,
    itemId: string,
    patch: PlaylistItemPatch,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Appends a section; false when the playlist is gone. */
  addSection(
    playlistId: string,
    section: NewPlaylistSection,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /**
   * Hands the plan every slot, flagged `hidden` where the viewer may not watch the video. Answers
   * false, and writes nothing, when the playlist is gone.
   */
  reorder<F>(
    playlistId: string,
    viewer: UserContext,
    plan: ReorderPlan<F>
  ): Promise<Result<boolean, DatabaseUnavailable | F>>;
  /**
   * Writes `sort` back as positions, whatever the viewer may watch; sections keep their order after
   * the videos. False when the playlist is gone.
   */
  writeSort(
    playlistId: string,
    sort: Exclude<PlaylistItemSort, 'manual'>,
    viewer: UserContext
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /**
   * Copies the items into `targetId`, and on a move takes them out of `sourceId`, in one
   * transaction. An item no longer in the source is `source-missing`.
   */
  transfer(
    sourceId: string,
    targetId: string,
    items: readonly StoredPlaylistItem[],
    mode: 'move' | 'copy',
    actorId: string
  ): Promise<Result<TransferOutcome, DatabaseUnavailable>>;
  /**
   * Copies every source into `targetId` and deletes each source that asked once every one of its
   * items is in the target, all in one transaction, so a failure leaves every source whole.
   */
  merge(
    targetId: string,
    sources: readonly MergeSource[],
    actorId: string
  ): Promise<Result<MergeOutcome, DatabaseUnavailable>>;
  /**
   * Puts a removed item back at the end, as it stood, and logs the restore. An activity restored
   * already, or a video the playlist holds, is `present`.
   */
  restoreItem(
    playlistId: string,
    activity: RestorablePlaylistActivity,
    actorId: string
  ): Promise<Result<RestoreItemOutcome, DatabaseUnavailable>>;
}
