import { type Result, ok, unwrapOr } from '@kit/result';
import type { AppendItemOutcome, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import {
  type Playlist,
  type PlaylistActivityEntry,
  type PlaylistEntry,
  type PlaylistItemSort,
  type PositionWrite,
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
  seats: () => Pick<InMemoryPlaylistCollaboratorRepository, 'seatOf' | 'record' | 'forget'>;
  history: () => Pick<WatchHistoryRepositoryPort, 'findMany'>;
}

export interface KeyedRow {
  id: string;
  key: string | number;
}

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
