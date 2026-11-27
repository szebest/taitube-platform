import { type Result, ok, unwrapOr } from '@kit/result';
import type {
  ListPlaylistItemsOptions,
  ListPublicPlaylistsOptions,
  SortedPlaylistEntry,
} from '@vp/core/repositories';
import {
  type OwnedPlaylist,
  PLAYLIST_PREVIEW_THUMBNAILS,
  type Playlist,
  type PlaylistDetail,
  type PlaylistEntry,
  type PlaylistSection,
  type PublicPlaylist,
  type SeatedPlaylist,
  type StoredPlaylistItem,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type UserContext, canReadPlaylist } from '@vp/permissions';
import { SORT_ORDER, compareSorted, isPast, toStored } from './in-memory-playlist-items';
import { InMemoryPlaylistStore } from './in-memory-playlist-store';
import { byKeysetDesc, isKeysetBefore } from './keyset';
import { primaryChannelCard, watchableVideo } from './watchable-video';

function newestFirst(a: Playlist, b: Playlist): number {
  return (
    Number(b.isSystem) - Number(a.isSystem) ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    b.id.localeCompare(a.id)
  );
}

/** The reads of the in-memory playlist repository, over the store's rows. */
export class InMemoryPlaylistReads extends InMemoryPlaylistStore {
  getAllPlaylists(): Playlist[] {
    return Array.from(this.playlists.values());
  }

  ownerOf(playlistId: string): string | null {
    return this.playlists.get(playlistId)?.ownerId ?? null;
  }

  async findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    return ok(this.playlists.get(id) ?? null);
  }

  async findSeated(
    id: string,
    userId: string | null
  ): Promise<Result<SeatedPlaylist | null, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!playlist) return ok(null);
    const role = this.deps.seats().seatOf(id, userId);
    return ok({ ...playlist, collaboratorId: role ? userId : null, collaboratorRole: role });
  }

  async findDetail(
    id: string,
    viewer: UserContext | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>> {
    const seated = unwrapOr(await this.findSeated(id, viewer?.id ?? null), null);
    if (!(seated && canReadPlaylist({ user: viewer, playlist: seated }))) return ok(null);

    const rows = this.itemsOf(id);
    const entries = await Promise.all(
      rows.map((item, position) => this.entryOf(item, position, viewer))
    );
    const sections: PlaylistSection[] = rows.flatMap((item, position) =>
      item.kind === 'section' && item.title !== null
        ? [{ id: item.id, title: item.title, position, addedBy: item.addedBy }]
        : []
    );
    const { collaboratorId: _, collaboratorRole: __, ...playlist } = seated;
    return ok({
      playlist,
      owner: await primaryChannelCard(this.deps, playlist.ownerId),
      items: entries.filter((entry): entry is PlaylistEntry => entry !== null),
      sections,
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
          const items = this.videosOf(playlist.id);
          const watchable = await Promise.all(
            items.map((item) => watchableVideo(this.deps, owner, item.videoId ?? ''))
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

  async listPublicByOwner(
    ownerId: string,
    { cursor, limit }: ListPublicPlaylistsOptions
  ): Promise<Result<PublicPlaylist[], DatabaseUnavailable>> {
    const keyOf = ({ updatedAt, id }: Playlist) => ({ sort: updatedAt, tie: id });
    const listed = [...this.playlists.values()]
      .filter(
        (playlist) =>
          playlist.ownerId === ownerId && playlist.visibility === 'public' && !playlist.isSystem
      )
      .sort((a, b) => byKeysetDesc(keyOf(a), keyOf(b)))
      .filter((playlist) =>
        isKeysetBefore(keyOf(playlist), cursor && { sort: cursor.updatedAt, tie: cursor.id })
      )
      .slice(0, limit + 1);

    return ok(
      await Promise.all(
        listed.map(async (playlist) => {
          const watchable = await Promise.all(
            this.videosOf(playlist.id).map((item) =>
              watchableVideo(this.deps, null, item.videoId ?? '')
            )
          );
          const videos = watchable.filter((entry) => entry !== null).map(({ video }) => video);
          return {
            ...playlist,
            videoCount: videos.length,
            posterKeys: videos
              .flatMap((video) => (video.posterKey ? [video.posterKey] : []))
              .slice(0, PLAYLIST_PREVIEW_THUMBNAILS),
          };
        })
      )
    );
  }

  async listItemOwners(
    playlistId: string
  ): Promise<Result<{ id: string; ownerId: string }[], DatabaseUnavailable>> {
    const videos = await Promise.all(
      this.videosOf(playlistId).map(async ({ videoId }) =>
        unwrapOr(await this.deps.videosRepo.findById(videoId ?? ''), null)
      )
    );
    return ok(videos.filter((video) => video !== null).map(({ id, ownerId }) => ({ id, ownerId })));
  }

  async listItems(
    playlistId: string,
    viewer: UserContext | null,
    { sort, cursor, limit }: ListPlaylistItemsOptions
  ): Promise<Result<SortedPlaylistEntry[], DatabaseUnavailable>> {
    const order = SORT_ORDER[sort];
    const keyed = await this.keyedVideos(playlistId, sort, viewer, true);
    return ok(
      keyed
        .sort((a, b) => compareSorted(a, b, order))
        .filter((row) => isPast(row, cursor, order))
        .slice(0, limit + 1)
        .flatMap(({ entry, key }) => (entry ? [{ entry, key }] : []))
    );
  }

  async findItems(
    playlistId: string,
    itemIds?: readonly string[]
  ): Promise<Result<StoredPlaylistItem[], DatabaseUnavailable>> {
    const wanted = itemIds && new Set(itemIds);
    return ok(
      this.itemsOf(playlistId)
        .filter((item) => !wanted || wanted.has(item.id))
        .map(toStored)
    );
  }
}
