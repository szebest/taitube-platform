import type {
  AddPlaylistItemOutcome,
  NewPlaylistItem,
  PlaylistRepositoryPort,
  ReorderPlan,
} from '@vp/core/repositories';
import {
  type NewPlaylistInput,
  type OwnedPlaylist,
  POSITION_GAP,
  type Playlist,
  type PlaylistDetail,
  type PlaylistEntry,
  type PlaylistPatch,
  type PositionWrite,
  WATCH_LATER_TITLE,
  appendPosition,
  renumberPositions,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type UserContext, canReadPlaylist } from '@vp/permissions';
import { type Result, isErr, ok, unwrapOr } from '@vp/result';
import { type VideoLookups, channelCard, watchableVideo } from './watchable-video';

interface StoredItem {
  id: string;
  playlistId: string;
  videoId: string;
  position: number;
  addedAt: Date;
}

function byPosition(a: StoredItem, b: StoredItem): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function newestFirst(a: Playlist, b: Playlist): number {
  return (
    Number(b.isSystem) - Number(a.isSystem) ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    b.id.localeCompare(a.id)
  );
}

export class InMemoryPlaylistRepository implements PlaylistRepositoryPort {
  private readonly playlists = new Map<string, Playlist>();
  private readonly items = new Map<string, StoredItem>();

  constructor(private readonly lookups: VideoLookups) {}

  async create(input: NewPlaylistInput): Promise<Result<Playlist, DatabaseUnavailable>> {
    const now = new Date();
    const playlist: Playlist = {
      ...input,
      isSystem: false,
      customThumbnailKey: null,
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
      isSystem: true,
      customThumbnailKey: null,
      createdAt: now,
      updatedAt: now,
    });
    return ok();
  }

  async findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    return ok(this.playlists.get(id) ?? null);
  }

  async findDetail(
    id: string,
    viewer: UserContext | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!(playlist && canReadPlaylist({ user: viewer, playlist }))) return ok(null);

    const entries = await Promise.all(
      this.itemsOf(id).map(async (item, position): Promise<PlaylistEntry | null> => {
        const watchable = await watchableVideo(this.lookups, viewer, item.videoId);
        return (
          watchable && {
            id: item.id,
            videoId: item.videoId,
            addedAt: item.addedAt,
            position,
            ...watchable,
          }
        );
      })
    );
    return ok({
      playlist: { ...playlist },
      owner: await channelCard(this.lookups, playlist.ownerId),
      items: entries.filter((entry): entry is PlaylistEntry => entry !== null),
    });
  }

  async listOwned(
    owner: UserContext,
    videoId: string | null
  ): Promise<Result<OwnedPlaylist[], DatabaseUnavailable>> {
    const owned = [...this.playlists.values()]
      .filter((playlist) => playlist.ownerId === owner.id)
      .sort(newestFirst);
    return ok(
      await Promise.all(
        owned.map(async (playlist) => {
          const items = this.itemsOf(playlist.id);
          const watchable = await Promise.all(
            items.map((item) => watchableVideo(this.lookups, owner, item.videoId))
          );
          return {
            ...playlist,
            videoCount: watchable.filter(Boolean).length,
            containsVideo: items.some((item) => item.videoId === videoId),
          };
        })
      )
    );
  }

  async update(
    id: string,
    patch: PlaylistPatch
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!playlist) return ok(null);
    Object.assign(playlist, patch, { updatedAt: new Date() });
    return ok({ ...playlist });
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!playlist || playlist.isSystem) return ok(false);
    this.playlists.delete(id);
    for (const item of this.itemsOf(id)) this.items.delete(item.id);
    return ok(true);
  }

  async addItem(
    playlistId: string,
    item: NewPlaylistItem
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>> {
    const video = unwrapOr(await this.lookups.videosRepo.findById(item.videoId), null);
    if (!this.playlists.has(playlistId)) return ok('playlist-missing');
    if (!video) return ok('video-missing');
    const items = this.itemsOf(playlistId);
    if (items.some((held) => held.videoId === item.videoId)) return ok('present');

    const position = appendPosition(items.at(-1)?.position ?? null) ?? this.renumbered(items);
    this.items.set(item.id, { ...item, playlistId, position, addedAt: new Date() });
    this.touch(playlistId);
    return ok('added');
  }

  async removeItem(
    playlistId: string,
    videoId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const item = this.itemsOf(playlistId).find((held) => held.videoId === videoId);
    if (!item) return ok(false);
    this.items.delete(item.id);
    this.touch(playlistId);
    return ok(true);
  }

  async reorder<F>(
    playlistId: string,
    plan: ReorderPlan<F>
  ): Promise<Result<boolean, DatabaseUnavailable | F>> {
    if (!this.playlists.has(playlistId)) return ok(false);
    const writes = plan(this.itemsOf(playlistId).map(({ id, position }) => ({ id, position })));
    if (isErr(writes)) return writes;
    this.write(writes.value);
    this.touch(playlistId);
    return ok(true);
  }

  clear(): void {
    this.playlists.clear();
    this.items.clear();
  }

  private itemsOf(playlistId: string): StoredItem[] {
    return [...this.items.values()]
      .filter((item) => item.playlistId === playlistId)
      .sort(byPosition);
  }

  private renumbered(items: readonly StoredItem[]): number {
    this.write(renumberPositions(items.map((item) => item.id)));
    return items.length * POSITION_GAP;
  }

  private write(writes: readonly PositionWrite[]): void {
    for (const { id, position } of writes) {
      const item = this.items.get(id);
      if (item) item.position = position;
    }
  }

  private touch(playlistId: string): void {
    const playlist = this.playlists.get(playlistId);
    if (playlist) playlist.updatedAt = new Date();
  }
}
