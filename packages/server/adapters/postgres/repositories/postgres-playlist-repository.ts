import type {
  AddPlaylistItemOutcome,
  NewPlaylistItem,
  PlaylistRepositoryPort,
  ReorderPlan,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type NewPlaylistInput,
  type OwnedPlaylist,
  POSITION_GAP,
  type Playlist,
  type PlaylistDetail,
  type PlaylistPatch,
  WATCH_LATER_TITLE,
  appendPosition,
  renumberPositions,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, err, fromPromise, isErr, map, ok } from '@vp/result';
import { and, asc, count, desc, eq, getTableColumns, inArray, max, sql } from 'drizzle-orm';
import { drizzleWhere, playlistReadScope, watchableVideoScope } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import {
  entriesOf,
  reorderSlots,
  toPlaylist,
  toPlaylistEntry,
  writePositions,
} from './playlist-query';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v, channels: ch } = schema;

export class PostgresPlaylistRepository implements PlaylistRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(input: NewPlaylistInput): Promise<Result<Playlist, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(p).values(input).returning(),
      databaseUnavailable.during('createPlaylist')
    );
    return andThen(rows, ([row]) =>
      row ? ok(toPlaylist(row)) : err(databaseUnavailable('createPlaylist', 'no row returned'))
    );
  }

  async provisionWatchLater(input: {
    id: string;
    ownerId: string;
  }): Promise<Result<void, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () =>
        this.db
          .insert(p)
          .values({ ...input, title: WATCH_LATER_TITLE, visibility: 'private', isSystem: true })
          .onConflictDoNothing({ target: p.ownerId, where: sql`${p.isSystem}` }),
      databaseUnavailable.during('provisionWatchLater')
    );
    return map(inserted, () => undefined);
  }

  async findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(p).where(eq(p.id, id)),
      databaseUnavailable.during('findPlaylist')
    );
    return map(rows, ([row]) => (row ? toPlaylist(row) : null));
  }

  async findDetail(
    id: string,
    viewer: UserContext | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>> {
    const headers = await fromPromise(
      () =>
        this.db
          .select({ playlist: getTableColumns(p), ...channelCardColumns })
          .from(p)
          .leftJoin(ch, eq(ch.userId, p.ownerId))
          .where(drizzleWhere(eq(p.id, id), playlistReadScope(viewer))),
      databaseUnavailable.during('findPlaylist')
    );
    if (isErr(headers)) return headers;
    const [header] = headers.value;
    if (!header) return ok(null);

    const entries = await fromPromise(
      () => entriesOf(this.db, id, viewer),
      databaseUnavailable.during('listPlaylistItems')
    );
    const { playlist, ...owner } = header;
    return map(entries, (rows) => ({
      playlist: toPlaylist(playlist),
      owner: toChannelCard(owner),
      items: rows.map(toPlaylistEntry),
    }));
  }

  async listOwned(
    owner: UserContext,
    videoId: string | null
  ): Promise<Result<OwnedPlaylist[], DatabaseUnavailable>> {
    const videoCount = this.db
      .select({ n: count() })
      .from(pi)
      .innerJoin(v, eq(v.id, pi.videoId))
      .where(drizzleWhere(eq(pi.playlistId, p.id), watchableVideoScope(owner)));
    const holdsVideo =
      videoId === null
        ? sql`false`
        : inArray(
            p.id,
            this.db.select({ id: pi.playlistId }).from(pi).where(eq(pi.videoId, videoId))
          );

    return await fromPromise(
      () =>
        this.db
          .select({
            ...getTableColumns(p),
            videoCount: sql<number>`(${videoCount})`.mapWith(Number),
            containsVideo: sql<boolean>`${holdsVideo}`.mapWith(Boolean),
          })
          .from(p)
          .where(eq(p.ownerId, owner.id))
          .orderBy(desc(p.isSystem), desc(p.updatedAt), desc(p.id)),
      databaseUnavailable.during('listOwnedPlaylists')
    );
  }

  async update(
    id: string,
    patch: PlaylistPatch
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(p)
          .set({ ...patch, updatedAt: sql`now()` })
          .where(eq(p.id, id))
          .returning(),
      databaseUnavailable.during('updatePlaylist')
    );
    return map(rows, ([row]) => (row ? toPlaylist(row) : null));
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(p)
          .where(and(eq(p.id, id), eq(p.isSystem, false)))
          .returning({ id: p.id }),
      databaseUnavailable.during('removePlaylist')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async addItem(
    playlistId: string,
    item: NewPlaylistItem
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<AddPlaylistItemOutcome> => {
          if (!(await this.lockPlaylist(tx, playlistId))) return 'playlist-missing';
          const [video] = await tx
            .select({ id: v.id })
            .from(v)
            .where(eq(v.id, item.videoId))
            .for('share');
          if (!video) return 'video-missing';

          const inserted = await tx
            .insert(pi)
            .values({ ...item, playlistId, position: await this.nextPosition(tx, playlistId) })
            .onConflictDoNothing({ target: [pi.playlistId, pi.videoId] })
            .returning({ id: pi.id });
          if (inserted.length === 0) return 'present';
          await this.touch(tx, playlistId);
          return 'added';
        }),
      databaseUnavailable.during('addPlaylistItem')
    );
  }

  async removeItem(
    playlistId: string,
    videoId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (!(await this.lockPlaylist(tx, playlistId))) return false;
          const removed = await tx
            .delete(pi)
            .where(and(eq(pi.playlistId, playlistId), eq(pi.videoId, videoId)))
            .returning({ id: pi.id });
          if (removed.length > 0) await this.touch(tx, playlistId);
          return removed.length > 0;
        }),
      databaseUnavailable.during('removePlaylistItem')
    );
  }

  async reorder<F>(
    playlistId: string,
    viewer: UserContext,
    plan: ReorderPlan<F>
  ): Promise<Result<boolean, DatabaseUnavailable | F>> {
    const outcome = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<Result<boolean, F>> => {
          if (!(await this.lockPlaylist(tx, playlistId))) return ok(false);
          const writes = plan(await reorderSlots(tx, playlistId, viewer));
          if (isErr(writes)) return writes;
          await writePositions(tx, playlistId, writes.value);
          await this.touch(tx, playlistId);
          return ok(true);
        }),
      databaseUnavailable.during('reorderPlaylist')
    );
    return andThen(outcome, (decided) => decided);
  }

  private async lockPlaylist(tx: PostgresDatabase, playlistId: string): Promise<boolean> {
    const [row] = await tx.select({ id: p.id }).from(p).where(eq(p.id, playlistId)).for('update');
    return Boolean(row);
  }

  private positions(tx: PostgresDatabase, playlistId: string) {
    return tx
      .select({ id: pi.id, position: pi.position })
      .from(pi)
      .where(eq(pi.playlistId, playlistId))
      .orderBy(asc(pi.position), asc(pi.id));
  }

  private async nextPosition(tx: PostgresDatabase, playlistId: string): Promise<number> {
    const [last] = await tx
      .select({ position: max(pi.position) })
      .from(pi)
      .where(eq(pi.playlistId, playlistId));
    const next = appendPosition(last?.position ?? null);
    if (next !== null) return next;

    const order = (await this.positions(tx, playlistId)).map((row) => row.id);
    await writePositions(tx, playlistId, renumberPositions(order));
    return order.length * POSITION_GAP;
  }

  private async touch(tx: PostgresDatabase, playlistId: string): Promise<void> {
    await tx.update(p).set({ updatedAt: sql`now()` }).where(eq(p.id, playlistId));
  }
}
