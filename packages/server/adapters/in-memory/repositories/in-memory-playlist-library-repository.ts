import { type Result, ok, unwrapOr } from '@kit/result';
import type {
  FollowOutcome,
  FollowedPlaylist,
  ListFollowedOptions,
  PlaylistCopy,
  PinOutcome,
  PlaylistLibraryRepositoryPort,
} from '@vp/core/repositories';
import type { Playlist } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { copyOf } from './in-memory-playlist-items';
import type { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

interface Follow {
  userId: string;
  playlistId: string;
  followedAt: Date;
}

type Playlists = Pick<
  InMemoryPlaylistRepository,
  'create' | 'findById' | 'findDetail' | 'rowsOf' | 'seedRows' | 'pin' | 'unpin'
>;

/** Pins and copies live on the playlists; the follows are this repository's own rows. */
export class InMemoryPlaylistLibraryRepository implements PlaylistLibraryRepositoryPort {
  private follows: Follow[] = [];

  constructor(private readonly playlists: () => Playlists) {}

  async pin(
    ownerId: string,
    playlistId: string,
    at: Date
  ): Promise<Result<PinOutcome, DatabaseUnavailable>> {
    return ok(this.playlists().pin(ownerId, playlistId, at));
  }

  async unpin(playlistId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.playlists().unpin(playlistId));
  }

  async follow(
    userId: string,
    playlistId: string
  ): Promise<Result<FollowOutcome, DatabaseUnavailable>> {
    const playlist = unwrapOr(await this.playlists().findById(playlistId), null);
    if (!playlist) return ok('playlist-missing');
    if (this.indexOf(userId, playlistId) >= 0) return ok('present');
    this.follows.push({ userId, playlistId, followedAt: new Date() });
    return ok('followed');
  }

  async unfollow(
    userId: string,
    playlistId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const index = this.indexOf(userId, playlistId);
    if (index < 0) return ok(false);
    this.follows.splice(index, 1);
    return ok(true);
  }

  async listFollowed(
    viewer: UserContext,
    { cursor, limit }: ListFollowedOptions
  ): Promise<Result<FollowedPlaylist[], DatabaseUnavailable>> {
    const bound = cursor && { sort: cursor.followedAt, tie: cursor.playlistId };
    const page = this.follows
      .filter((follow) => follow.userId === viewer.id)
      .map((follow) => ({ follow, sort: follow.followedAt, tie: follow.playlistId }))
      .filter((row) => isKeysetBefore(row, bound))
      .sort(byKeysetDesc)
      .slice(0, limit + 1);
    return ok(
      await Promise.all(
        page.map(async ({ follow: { playlistId, followedAt } }) => ({
          playlistId,
          followedAt,
          playlist: await this.cardOf(playlistId, viewer),
        }))
      )
    );
  }

  async fork(
    sourceId: string,
    copy: PlaylistCopy
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const source = unwrapOr(await this.playlists().findById(sourceId), null);
    if (!source) return ok(null);
    const created = await this.playlists().create({
      ...copy,
      description: source.description,
      visibility: 'private',
      rules: source.rules,
      forkedFromPlaylistId: sourceId,
    });
    if (!created.ok) return created;
    const rows = this.playlists().rowsOf(sourceId);
    await this.playlists().seedRows(
      created.value.id,
      rows.map((row) => copyOf(row, copy.ownerId, uuidv7()))
    );
    return created;
  }

  async freeze(
    copy: PlaylistCopy & { description: string },
    videoIds: readonly string[]
  ): Promise<Result<Playlist, DatabaseUnavailable>> {
    const created = await this.playlists().create({ ...copy, visibility: 'private' });
    if (!created.ok) return created;
    await this.playlists().seedRows(
      created.value.id,
      videoIds.map((videoId) => ({ kind: 'video', id: uuidv7(), videoId, addedBy: copy.ownerId }))
    );
    return created;
  }

  isFollowing(userId: string | null, playlistId: string): boolean {
    return userId !== null && this.indexOf(userId, playlistId) >= 0;
  }

  clear(): void {
    this.follows = [];
  }

  private indexOf(userId: string, playlistId: string): number {
    return this.follows.findIndex(
      (follow) => follow.userId === userId && follow.playlistId === playlistId
    );
  }

  private async cardOf(
    playlistId: string,
    viewer: UserContext
  ): Promise<FollowedPlaylist['playlist']> {
    const detail = unwrapOr(await this.playlists().findDetail(playlistId, viewer), null);
    if (!detail) return null;
    const { playlist, owner, items } = detail;
    return {
      title: playlist.title,
      visibility: playlist.visibility,
      isSmart: playlist.rules !== null,
      customThumbnailKey: playlist.customThumbnailKey,
      posterKey: items.find((item) => item.video.posterKey)?.video.posterKey ?? null,
      videoCount: items.length,
      owner,
      updatedAt: playlist.updatedAt,
    };
  }
}
