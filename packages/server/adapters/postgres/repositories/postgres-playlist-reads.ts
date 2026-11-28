import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, fromPromise, map } from '@kit/result';
import type {
  ListPlaylistItemsOptions,
  ListPublicPlaylistsOptions,
  SortedPlaylistEntry,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  OwnedPlaylist,
  Playlist,
  PlaylistDetail,
  PublicPlaylist,
  SeatedPlaylist,
  StoredPlaylistItem,
} from '@vp/domain';
import type { ShareGrant, UserContext } from '@vp/permissions';
import { eq } from 'drizzle-orm';
import { storedItems } from './playlist-item-writes';
import { publicPlaylistsOf, sortedItems, toPlaylist, toStoredItem } from './playlist-query';
import { detailOf, ownedBy, seatedOf } from './playlist-reads';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v } = schema;

/** The reads of the postgres playlist repository; its writes extend them. */
export class PostgresPlaylistReads {
  constructor(protected readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(p).where(eq(p.id, id)),
      databaseUnavailable.during('findPlaylist')
    );
    return map(rows, ([row]) => (row ? toPlaylist(row) : null));
  }

  async findSeated(
    id: string,
    userId: string | null
  ): Promise<Result<SeatedPlaylist | null, DatabaseUnavailable>> {
    return await fromPromise(
      () => seatedOf(this.db, id, userId),
      databaseUnavailable.during('findSeatedPlaylist')
    );
  }

  async findDetail(
    id: string,
    viewer: UserContext | null,
    share: ShareGrant | null = null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>> {
    return await fromPromise(
      () => detailOf(this.db, id, viewer, share),
      databaseUnavailable.during('findPlaylist')
    );
  }

  async listOwned(
    owner: UserContext,
    videoId: string | null
  ): Promise<Result<OwnedPlaylist[], DatabaseUnavailable>> {
    return await fromPromise(
      () => ownedBy(this.db, owner, videoId),
      databaseUnavailable.during('listOwnedPlaylists')
    );
  }

  async listPublicByOwner(
    ownerId: string,
    options: ListPublicPlaylistsOptions
  ): Promise<Result<PublicPlaylist[], DatabaseUnavailable>> {
    return await fromPromise(
      () => publicPlaylistsOf(this.db, ownerId, options),
      databaseUnavailable.during('listPublicPlaylists')
    );
  }

  async listItemOwners(
    playlistId: string
  ): Promise<Result<{ id: string; ownerId: string }[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select({ id: v.id, ownerId: v.ownerId })
          .from(pi)
          .innerJoin(v, eq(v.id, pi.videoId))
          .where(eq(pi.playlistId, playlistId)),
      databaseUnavailable.during('listPlaylistItemOwners')
    );
  }

  async listItems(
    playlistId: string,
    viewer: UserContext | null,
    options: ListPlaylistItemsOptions
  ): Promise<Result<SortedPlaylistEntry[], DatabaseUnavailable>> {
    return await fromPromise(
      () => sortedItems(this.db, playlistId, viewer, options),
      databaseUnavailable.during('listSortedPlaylistItems')
    );
  }

  async findItems(
    playlistId: string,
    itemIds?: readonly string[]
  ): Promise<Result<StoredPlaylistItem[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => storedItems(this.db, playlistId, itemIds),
      databaseUnavailable.during('findPlaylistItems')
    );
    return map(rows, (found) => found.map(toStoredItem));
  }
}
