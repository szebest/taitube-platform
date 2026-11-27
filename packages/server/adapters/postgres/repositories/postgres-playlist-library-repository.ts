import { type Result, andThen, err, fromPromise, map, ok } from '@kit/result';
import type {
  FollowOutcome,
  FollowedPlaylist,
  ListFollowedOptions,
  PlaylistCopy,
  PlaylistLibraryRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Playlist } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { drizzleWhere, keysetBefore, msTimestamp } from '../scopes/index';
import { copyOf } from './playlist-bulk-writes';
import { followedCardsOf } from './playlist-follow-query';
import { appendRows, storedItems } from './playlist-item-writes';
import { toPlaylist, toStoredItem } from './playlist-query';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistFollows: pf } = schema;

export class PostgresPlaylistLibraryRepository implements PlaylistLibraryRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async countPinned(ownerId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ n: count() })
          .from(p)
          .where(and(eq(p.ownerId, ownerId), isNotNull(p.pinnedAt))),
      databaseUnavailable.during('countPinnedPlaylists')
    );
    return map(rows, ([row]) => row?.n ?? 0);
  }

  async setPinned(
    playlistId: string,
    at: Date | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db.update(p).set({ pinnedAt: at }).where(eq(p.id, playlistId)).returning({ id: p.id }),
      databaseUnavailable.during('pinPlaylist')
    );
    return map(rows, (pinned) => pinned.length > 0);
  }

  async follow(
    userId: string,
    playlistId: string
  ): Promise<Result<FollowOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<FollowOutcome> => {
          const [held] = await tx
            .select({ id: p.id })
            .from(p)
            .where(eq(p.id, playlistId))
            .for('share');
          if (!held) return 'playlist-missing';
          const inserted = await tx
            .insert(pf)
            .values({ userId, playlistId })
            .onConflictDoNothing()
            .returning({ playlistId: pf.playlistId });
          return inserted.length > 0 ? 'followed' : 'present';
        }),
      databaseUnavailable.during('followPlaylist')
    );
  }

  async unfollow(
    userId: string,
    playlistId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(pf)
          .where(and(eq(pf.userId, userId), eq(pf.playlistId, playlistId)))
          .returning({ playlistId: pf.playlistId }),
      databaseUnavailable.during('unfollowPlaylist')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async listFollowed(
    viewer: UserContext,
    { cursor, limit }: ListFollowedOptions
  ): Promise<Result<FollowedPlaylist[], DatabaseUnavailable>> {
    return await fromPromise(async () => {
      const follows = await this.db
        .select({ playlistId: pf.playlistId, followedAt: pf.createdAt })
        .from(pf)
        .where(
          drizzleWhere(
            eq(pf.userId, viewer.id),
            keysetBefore(
              msTimestamp(pf.createdAt),
              pf.playlistId,
              cursor && { sort: cursor.followedAt, tie: cursor.playlistId }
            )
          )
        )
        .orderBy(desc(msTimestamp(pf.createdAt)), desc(pf.playlistId))
        .limit(limit + 1);
      const cards = await followedCardsOf(
        this.db,
        viewer,
        follows.map(({ playlistId }) => playlistId)
      );
      return follows.map((follow) => ({
        ...follow,
        playlist: cards.get(follow.playlistId) ?? null,
      }));
    }, databaseUnavailable.during('listFollowedPlaylists'));
  }

  async fork(
    sourceId: string,
    copy: PlaylistCopy
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [source] = await tx.select().from(p).where(eq(p.id, sourceId)).for('share');
          if (!source) return null;
          const [created] = await tx
            .insert(p)
            .values({
              ...copy,
              description: source.description,
              visibility: 'private',
              rules: source.rules,
              forkedFromPlaylistId: sourceId,
            })
            .returning();
          if (!created) return null;
          const rows = (await storedItems(tx, sourceId)).map(toStoredItem);
          await appendRows(
            tx,
            created.id,
            rows.map((row) => copyOf(row, copy.ownerId))
          );
          return toPlaylist(created);
        }),
      databaseUnavailable.during('forkPlaylist')
    );
  }

  async freeze(
    copy: PlaylistCopy & { description: string },
    videoIds: readonly string[]
  ): Promise<Result<Playlist, DatabaseUnavailable>> {
    const created = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(p)
            .values({ ...copy, visibility: 'private' })
            .returning();
          if (!row) return null;
          await appendRows(
            tx,
            row.id,
            videoIds.map((videoId) => ({
              kind: 'video',
              id: uuidv7(),
              videoId,
              addedBy: copy.ownerId,
            }))
          );
          return toPlaylist(row);
        }),
      databaseUnavailable.during('freezePlaylist')
    );
    return andThen(created, (playlist) =>
      playlist ? ok(playlist) : err(databaseUnavailable('freezePlaylist', 'no row returned'))
    );
  }
}
