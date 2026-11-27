import { type Result, assertNever, err, isErr, map, ok } from '@kit/result';
import type { OwnedPlaylistView, PlaylistView } from '@vp/api-contracts';
import type {
  PlaylistCollaboratorRepositoryPort,
  PlaylistRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import {
  type Playlist,
  type PlaylistKind,
  type SeatedPlaylist,
  type PlaylistPatch,
  type PlaylistReorder,
  type PlaylistVisibility,
  type SmartPlaylistRules,
} from '@vp/domain';
import {
  type CreatePlaylistFailure,
  type DeletePlaylistFailure,
  type ManagePlaylistFailure,
  type ReorderPlaylistFailure,
  type SeriesVideoNotOwned,
  type ShareLinkExpired,
  type UpdatePlaylistFailure,
  type VideoNotFound,
  coverVideoOf,
  decidePlaylistAction,
  decidePlaylistCreate,
  decidePlaylistDelete,
  decidePlaylistReorder,
  decidePlaylistUpdate,
  decideSeriesMembership,
  decideVideoRead,
  playlistNotFound,
  publicReadFailure,
  videoNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { toOwnedPlaylistView } from './library-views';
import type { PlaylistAccess, PlaylistReader, ReadPlaylistFailure } from './playlist-reader';

export interface PlaylistServiceDeps {
  playlists: PlaylistRepositoryPort;
  seats: Pick<PlaylistCollaboratorRepositoryPort, 'seats'>;
  videos: VideoRepository;
  reader: Pick<PlaylistReader, 'get' | 'open'>;
}
type CreatePlaylistServiceFailure = CreatePlaylistFailure | ReadPlaylistFailure;
type ItemsFailure = ManagePlaylistFailure | DatabaseUnavailable;
type AddItemFailure =
  | ItemsFailure
  | ReturnType<typeof publicReadFailure>
  | VideoNotFound
  | SeriesVideoNotOwned;

interface NewPlaylistBody {
  title: string;
  description?: string;
  visibility?: PlaylistVisibility;
  kind?: PlaylistKind;
  rules?: SmartPlaylistRules;
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
    return await this.deps.reader.get(actor, created.value.id);
  }

  async get(
    viewer: UserContext | null,
    playlistId: string
  ): Promise<Result<PlaylistView, ReadPlaylistFailure>> {
    return await this.deps.reader.get(viewer, playlistId);
  }

  /** A read of the page: through a share link if one is held, counting the open for anyone but the owner. */
  async open(
    viewer: UserContext | null,
    playlistId: string,
    access: PlaylistAccess
  ): Promise<Result<PlaylistView, ReadPlaylistFailure | ShareLinkExpired>> {
    return await this.deps.reader.open(viewer, playlistId, access);
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
  ): Promise<
    Result<PlaylistView, UpdatePlaylistFailure | SeriesVideoNotOwned | DatabaseUnavailable>
  > {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;

    const context = await this.settingsContext(playlist.value, patch);
    if (isErr(context)) return context;
    const decided = decidePlaylistUpdate({
      actor,
      playlist: playlist.value,
      playlistId,
      patch,
      context: context.value,
    });
    if (isErr(decided)) return decided;

    const owned = await this.checkSeriesConversion(actor, playlist.value, decided.value);
    if (isErr(owned)) return owned;

    const updated = await this.deps.playlists.update(playlistId, decided.value, actor.id);
    if (isErr(updated)) return updated;
    return updated.value
      ? await this.deps.reader.get(actor, playlistId)
      : err(playlistNotFound(playlistId));
  }

  async remove(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<void, DeletePlaylistFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
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
    const permitted = await this.permitted(actor, playlistId, 'addItem');
    if (isErr(permitted)) return permitted;

    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    const readable = decideVideoRead({ viewer: actor, video: video.value, videoId });
    if (isErr(readable)) return err(publicReadFailure(readable.error));

    const member = decideSeriesMembership(permitted.value, readable.value);
    if (isErr(member)) return member;

    const added = await this.deps.playlists.addItem(
      playlistId,
      { id: uuidv7(), videoId, addedBy: actor.id },
      actor.id
    );
    if (isErr(added)) return added;
    switch (added.value) {
      case 'added':
      case 'present':
        return await this.deps.reader.get(actor, playlistId);
      case 'playlist-missing':
        return err(playlistNotFound(playlistId));
      case 'video-missing':
        return err(videoNotFound(videoId));
      default:
        return assertNever(added.value, 'AddPlaylistItemOutcome');
    }
  }

  /** Removing an absent video changes nothing; a contributor removes only what they added. */
  async removeItem(
    actor: UserContext,
    playlistId: string,
    videoId: string
  ): Promise<Result<void, ItemsFailure>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const items = await this.deps.playlists.findItems(playlistId);
    if (isErr(items)) return items;

    const item = items.value.find((held) => held.videoId === videoId);
    const decided = decidePlaylistAction(
      { actor, playlist: playlist.value, playlistId },
      'removeItem',
      item ?? { addedBy: actor.id }
    );
    if (isErr(decided) || !item) return map(decided, () => undefined);

    const removed = await this.deps.playlists.removeItem(
      playlistId,
      { by: 'item', itemId: item.id },
      actor.id
    );
    return map(removed, () => undefined);
  }

  async reorder(
    actor: UserContext,
    playlistId: string,
    change: PlaylistReorder
  ): Promise<Result<PlaylistView, ItemsFailure | ReorderPlaylistFailure>> {
    const permitted = await this.permitted(actor, playlistId, 'manageItems');
    if (isErr(permitted)) return permitted;

    const reordered = await this.deps.playlists.reorder(playlistId, actor, (slots) =>
      decidePlaylistReorder(playlistId, slots, change)
    );
    if (isErr(reordered)) return reordered;
    return reordered.value
      ? await this.deps.reader.get(actor, playlistId)
      : err(playlistNotFound(playlistId));
  }

  private async permitted(
    actor: UserContext,
    playlistId: string,
    action: 'addItem' | 'manageItems'
  ): Promise<Result<SeatedPlaylist, ItemsFailure>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    return decidePlaylistAction({ actor, playlist: playlist.value, playlistId }, action);
  }

  /** The seats and the cover video a settings change is decided against, read only when it asks. */
  private async settingsContext(
    playlist: Playlist | null,
    patch: PlaylistPatch
  ): Promise<Result<{ seated: number; holdsCoverVideo: boolean }, DatabaseUnavailable>> {
    if (!playlist) return ok({ seated: 0, holdsCoverVideo: false });
    const seats =
      patch.autoRemoveWatched === true
        ? await this.deps.seats.seats(playlist.id, null)
        : ok({ seated: 0, isCollaborator: false });
    if (isErr(seats)) return seats;
    const coverVideoId = coverVideoOf(playlist, patch);
    const held = coverVideoId === null ? ok([]) : await this.deps.playlists.findItems(playlist.id);
    return map(held, (items) => ({
      seated: seats.value.seated,
      holdsCoverVideo: items.some((item) => item.videoId === coverVideoId),
    }));
  }

  /** A playlist becomes a series only when every video it holds is the owner's own. */
  private async checkSeriesConversion(
    actor: UserContext,
    playlist: Playlist | null,
    patch: PlaylistPatch
  ): Promise<Result<void, SeriesVideoNotOwned | DatabaseUnavailable>> {
    if (!playlist || patch.kind !== 'series' || playlist.kind === 'series') return ok();

    const held = await this.deps.playlists.listItemOwners(playlist.id);
    if (isErr(held)) return held;
    for (const video of held.value) {
      const member = decideSeriesMembership({ ...playlist, kind: 'series' }, video);
      if (isErr(member)) return member;
    }
    return ok();
  }
}
