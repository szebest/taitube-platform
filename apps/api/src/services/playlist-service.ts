import type { OwnedPlaylistView, PlaylistView } from '@vp/api-contracts';
import type { PlaylistRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { Playlist, PlaylistPatch, PlaylistReorder, PlaylistVisibility } from '@vp/domain';
import {
  type CreatePlaylistFailure,
  type DeletePlaylistFailure,
  type ManagePlaylistFailure,
  type PlaylistNotFound,
  type ReorderPlaylistFailure,
  type UpdatePlaylistFailure,
  type VideoNotFound,
  decidePlaylistCreate,
  decidePlaylistDelete,
  decidePlaylistItemsChange,
  decidePlaylistReorder,
  decidePlaylistUpdate,
  decideVideoRead,
  playlistNotFound,
  publicReadFailure,
  videoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, assertNever, err, isErr, map, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { toOwnedPlaylistView, toPlaylistView } from './library-views';

export interface PlaylistServiceDeps {
  playlists: PlaylistRepositoryPort;
  videos: VideoRepository;
  cdn: CdnBase;
}

type ReadPlaylistFailure = PlaylistNotFound | DatabaseUnavailable;
type CreatePlaylistServiceFailure = CreatePlaylistFailure | ReadPlaylistFailure;
type ItemsFailure = ManagePlaylistFailure | DatabaseUnavailable;
type AddItemFailure = ItemsFailure | ReturnType<typeof publicReadFailure> | VideoNotFound;

interface NewPlaylistBody {
  title: string;
  description?: string;
  visibility?: PlaylistVisibility;
}

/**
 * Playlists and their items. Every decision is a rule over the playlist as stored; the repository
 * re-checks what can change under it (the row, the item set) inside its own transaction.
 */
export class PlaylistService {
  constructor(private readonly deps: PlaylistServiceDeps) {}

  async create(
    actor: UserContext,
    body: NewPlaylistBody
  ): Promise<Result<PlaylistView, CreatePlaylistServiceFailure>> {
    const decided = decidePlaylistCreate({ actor, ...body });
    if (isErr(decided)) return decided;

    const created = await this.deps.playlists.create({
      id: uuidv7(),
      ownerId: actor.id,
      ...decided.value,
    });
    if (isErr(created)) return created;
    return await this.detail(actor, created.value.id);
  }

  async get(
    viewer: UserContext | null,
    playlistId: string
  ): Promise<Result<PlaylistView, ReadPlaylistFailure>> {
    return await this.detail(viewer, playlistId);
  }

  async listMine(
    actor: UserContext,
    videoId: string | null
  ): Promise<Result<{ items: OwnedPlaylistView[] }, DatabaseUnavailable>> {
    const owned = await this.deps.playlists.listOwned(actor, videoId);
    return map(owned, (rows) => ({
      items: rows.map(toOwnedPlaylistView),
    }));
  }

  async update(
    actor: UserContext,
    playlistId: string,
    patch: PlaylistPatch
  ): Promise<Result<PlaylistView, UpdatePlaylistFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findById(playlistId);
    if (isErr(playlist)) return playlist;

    const decided = decidePlaylistUpdate({ actor, playlist: playlist.value, playlistId, patch });
    if (isErr(decided)) return decided;

    const updated = await this.deps.playlists.update(playlistId, decided.value);
    if (isErr(updated)) return updated;
    return updated.value ? await this.detail(actor, playlistId) : err(playlistNotFound(playlistId));
  }

  async remove(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<void, DeletePlaylistFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findById(playlistId);
    if (isErr(playlist)) return playlist;

    const decided = decidePlaylistDelete({ actor, playlist: playlist.value, playlistId });
    if (isErr(decided)) return decided;

    const removed = await this.deps.playlists.remove(playlistId);
    if (isErr(removed)) return removed;
    return removed.value ? ok() : err(playlistNotFound(playlistId));
  }

  async addItem(
    actor: UserContext,
    playlistId: string,
    videoId: string
  ): Promise<Result<PlaylistView, AddItemFailure>> {
    const permitted = await this.itemsChange(actor, playlistId);
    if (isErr(permitted)) return permitted;

    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    const readable = decideVideoRead({ viewer: actor, video: video.value, videoId });
    if (isErr(readable)) return err(publicReadFailure(readable.error));

    const added = await this.deps.playlists.addItem(playlistId, { id: uuidv7(), videoId });
    if (isErr(added)) return added;
    switch (added.value) {
      case 'added':
      case 'present':
        return await this.detail(actor, playlistId);
      case 'playlist-missing':
        return err(playlistNotFound(playlistId));
      case 'video-missing':
        return err(videoNotFound(videoId));
      default:
        return assertNever(added.value, 'AddPlaylistItemOutcome');
    }
  }

  async removeItem(
    actor: UserContext,
    playlistId: string,
    videoId: string
  ): Promise<Result<void, ItemsFailure>> {
    const permitted = await this.itemsChange(actor, playlistId);
    if (isErr(permitted)) return permitted;

    const removed = await this.deps.playlists.removeItem(playlistId, videoId);
    return map(removed, () => undefined);
  }

  async reorder(
    actor: UserContext,
    playlistId: string,
    change: PlaylistReorder
  ): Promise<Result<PlaylistView, ItemsFailure | ReorderPlaylistFailure>> {
    const permitted = await this.itemsChange(actor, playlistId);
    if (isErr(permitted)) return permitted;

    const reordered = await this.deps.playlists.reorder(playlistId, (items) =>
      decidePlaylistReorder(playlistId, items, change)
    );
    if (isErr(reordered)) return reordered;
    return reordered.value
      ? await this.detail(actor, playlistId)
      : err(playlistNotFound(playlistId));
  }

  private async itemsChange(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<Playlist, ItemsFailure>> {
    const playlist = await this.deps.playlists.findById(playlistId);
    if (isErr(playlist)) return playlist;
    return decidePlaylistItemsChange({ actor, playlist: playlist.value, playlistId });
  }

  private async detail(
    viewer: UserContext | null,
    playlistId: string
  ): Promise<Result<PlaylistView, ReadPlaylistFailure>> {
    const found = await this.deps.playlists.findDetail(playlistId, viewer);
    if (isErr(found)) return found;
    return found.value
      ? ok(toPlaylistView(found.value, this.deps.cdn))
      : err(playlistNotFound(playlistId));
  }
}
