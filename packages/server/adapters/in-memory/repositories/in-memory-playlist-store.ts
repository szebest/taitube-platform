import { type Result, isErr, ok, unwrapOr } from '@kit/result';
import type { AppendItemOutcome, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import {
  DEFAULT_PLAYLIST_SETTINGS,
  type NewPlaylistInput,
  type Playlist,
  type PlaylistActivityEntry,
  type PlaylistEntry,
  type PlaylistItemSort,
  type PositionWrite,
  WATCH_LATER_TITLE,
  appendPositions,
  isWatchCompleted,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { InMemoryPlaylistCollaboratorRepository } from './in-memory-playlist-collaborator-repository';
import {
  type NewRow,
  type StoredItem,
  byPosition,
  removedOf,
  sortKeyOf,
  storedRow,
} from './in-memory-playlist-items';
import {
  type VideoLookups,
  channelCard,
  primaryChannelCard,
  watchableVideo,
} from './watchable-video';

export interface InMemoryPlaylistDeps extends VideoLookups {
  seats: () => Pick<
    InMemoryPlaylistCollaboratorRepository,
    'seatOf' | 'record' | 'forget' | 'userIdsOn'
  >;
  history: () => Pick<WatchHistoryRepositoryPort, 'findMany'>;
}

export interface KeyedRow {
  id: string;
  key: string | number;
}

const NEW_PLAYLIST = {
  ...DEFAULT_PLAYLIST_SETTINGS,
  isSystem: false,
  customThumbnailKey: null,
} as const satisfies Partial<Playlist>;

/** The playlists and their rows, and what every write does with them, for the repository on top. */
export class InMemoryPlaylistStore {
  protected readonly playlists = new Map<string, Playlist>();
  protected readonly items = new Map<string, StoredItem>();
  protected readonly restored = new Set<string>();

  constructor(protected readonly deps: InMemoryPlaylistDeps) {}

  clear(): void {
    this.playlists.clear();
    this.items.clear();
    this.restored.clear();
  }

  async create(input: NewPlaylistInput): Promise<Result<Playlist, DatabaseUnavailable>> {
    const now = new Date();
    const playlist: Playlist = {
      ...NEW_PLAYLIST,
      ...input,
      kind: input.kind ?? 'playlist',
      rules: input.rules ?? null,
      forkedFromPlaylistId: input.forkedFromPlaylistId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.playlists.set(playlist.id, playlist);
    return ok({ ...playlist });
  }

  async provisionWatchLater(input: {
    id: string;
    ownerId: string;
  }): Promise<Result<void, DatabaseUnavailable>> {
    const held = [...this.playlists.values()].some(
      (playlist) => playlist.ownerId === input.ownerId && playlist.isSystem
    );
    if (held) return ok();
    const now = new Date();
    this.playlists.set(input.id, {
      ...input,
      title: WATCH_LATER_TITLE,
      description: '',
      visibility: 'private',
      ...NEW_PLAYLIST,
      kind: 'playlist',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
    return ok();
  }

  /** Rows written as they stand, logging nothing: the items of a new fork or frozen copy. */
  async seedRows(playlistId: string, rows: readonly NewRow[]): Promise<void> {
    await this.appendRows(playlistId, rows);
  }

  rowsOf(playlistId: string): StoredItem[] {
    return this.itemsOf(playlistId);
  }

  countPinned(ownerId: string): number {
    return [...this.playlists.values()].filter(
      (playlist) => playlist.ownerId === ownerId && playlist.pinnedAt !== null
    ).length;
  }

  setPinned(playlistId: string, at: Date | null): boolean {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;
    playlist.pinnedAt = at;
    return true;
  }

  /** A seat taken ends removing watched videos, which is one viewer's fact; answers whether it was on. */
  stopAutoRemove(playlistId: string): boolean {
    const playlist = this.playlists.get(playlistId);
    if (!playlist?.autoRemoveWatched) return false;
    playlist.autoRemoveWatched = false;
    return true;
  }

  /** Takes a video the owner finished out of each list of theirs that asks, logging it to restore. */
  async removeWatched(userId: string, videoId: string): Promise<Result<void, DatabaseUnavailable>> {
    const lists = [...this.playlists.values()].filter(
      (playlist) =>
        playlist.ownerId === userId &&
        playlist.autoRemoveWatched &&
        this.deps.seats().userIdsOn(playlist.id).length === 0
    );
    for (const playlist of lists) {
      const item = this.videosOf(playlist.id).find((row) => row.videoId === videoId);
      if (!item) continue;
      this.items.delete(item.id);
      const logged = await this.log(playlist.id, userId, [
        { action: 'auto_removed', target: removedOf(item) },
      ]);
      if (isErr(logged)) return logged;
    }
    return ok();
  }

  /** Appends like the postgres adapter: a held video is `present`, a gone one `video-missing`. */
  protected async appendRows(
    playlistId: string,
    rows: readonly NewRow[]
  ): Promise<Map<string, AppendItemOutcome>> {
    const outcomes = new Map<string, AppendItemOutcome>();
    const taken = new Set(this.videosOf(playlistId).map((item) => item.videoId));
    const inserts: NewRow[] = [];
    for (const row of rows) {
      if (row.kind === 'section') {
        inserts.push(row);
        continue;
      }
      const video = unwrapOr(await this.deps.videosRepo.findById(row.videoId), null);
      if (!video) outcomes.set(row.id, 'video-missing');
      else if (taken.has(row.videoId)) outcomes.set(row.id, 'present');
      else {
        taken.add(row.videoId);
        outcomes.set(row.id, 'added');
        inserts.push(row);
      }
    }
    const { renumber, positions } = appendPositions(this.itemsOf(playlistId), inserts.length);
    this.write(renumber);
    for (const [index, row] of inserts.entries()) {
      this.items.set(row.id, storedRow(row, playlistId, positions[index] ?? 0));
    }
    return outcomes;
  }

  protected async entryOf(
    item: StoredItem,
    position: number,
    viewer: UserContext | null
  ): Promise<PlaylistEntry | null> {
    if (item.kind !== 'video' || item.videoId === null) return null;
    const watchable = await watchableVideo(this.deps, viewer, item.videoId);
    if (!watchable) return null;
    const { id, videoId, addedAt, addedBy, note, startMs, endMs } = item;
    return {
      id,
      videoId,
      position,
      addedAt,
      addedBy:
        addedBy === null
          ? null
          : { userId: addedBy, channel: await primaryChannelCard(this.deps, addedBy) },
      note,
      startMs,
      endMs,
      ...watchable,
    };
  }

  /** Every video row with its sort key; `viewer` scopes it unless the whole list is wanted. */
  protected async keyedVideos(
    playlistId: string,
    sort: PlaylistItemSort,
    viewer: UserContext | null,
    scoped: boolean
  ): Promise<(KeyedRow & { entry: PlaylistEntry | null })[]> {
    const rows = this.itemsOf(playlistId);
    const watched = await this.watchedBy(viewer, rows);
    const keyed = await Promise.all(
      rows.map(async (item, position) => {
        if (item.kind !== 'video' || item.videoId === null) return null;
        const entry = await this.entryOf(item, position, scoped ? viewer : null);
        const video = unwrapOr(await this.deps.videosRepo.findById(item.videoId), null);
        if (!video || (scoped && !entry)) return null;
        const channel = await channelCard(this.deps, video.channelId);
        const facts = {
          video,
          channelName: channel?.displayName ?? '',
          watched: watched.has(video.id),
        };
        return { id: item.id, key: sortKeyOf(sort, item, facts), entry };
      })
    );
    return keyed.filter((row) => row !== null);
  }

  protected async log(
    playlistId: string,
    actorId: string,
    entries: readonly PlaylistActivityEntry[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (entries.length === 0) return ok();
    const playlist = this.playlists.get(playlistId);
    if (playlist) playlist.updatedAt = new Date();
    return await this.deps.seats().record(playlistId, actorId, entries);
  }

  protected itemsOf(playlistId: string): StoredItem[] {
    return [...this.items.values()]
      .filter((item) => item.playlistId === playlistId)
      .sort(byPosition);
  }

  protected videosOf(playlistId: string): StoredItem[] {
    return this.itemsOf(playlistId).filter((item) => item.kind === 'video');
  }

  protected write(writes: readonly PositionWrite[]): void {
    for (const { id, position } of writes) {
      const item = this.items.get(id);
      if (item) item.position = position;
    }
  }

  private async watchedBy(
    viewer: UserContext | null,
    rows: readonly StoredItem[]
  ): Promise<Set<string>> {
    if (!viewer) return new Set();
    const videoIds = rows.flatMap((item) => (item.videoId ? [item.videoId] : []));
    const progress = unwrapOr(await this.deps.history().findMany(viewer.id, videoIds), []);
    return new Set(progress.filter(isWatchCompleted).map((playhead) => playhead.videoId));
  }
}
