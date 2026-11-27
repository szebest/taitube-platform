import { type Result, andThen, err, fromPromise, isErr, map, ok } from '@kit/result';
import type {
  AddPlaylistItemOutcome,
  AppendItemOutcome,
  ListPlaylistItemsOptions,
  ListPublicPlaylistsOptions,
  NewPlaylistItem,
  NewPlaylistSection,
  PlaylistItemTarget,
  PlaylistRepositoryPort,
  ReorderPlan,
  RestoreItemOutcome,
  SortedPlaylistEntry,
  TransferOutcome,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type NewPlaylistInput,
  type OwnedPlaylist,
  type Playlist,
  type PlaylistDetail,
  type PlaylistItemPatch,
  type PlaylistItemSort,
  type PlaylistPatch,
  type PublicPlaylist,
  type RestorablePlaylistActivity,
  type SeatedPlaylist,
  type StoredPlaylistItem,
  WATCH_LATER_TITLE,
  renumberPositions,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { appendLogged, logReorder, restoreRow, transferRows } from './playlist-bulk-writes';
import { recordPlaylistChange } from './playlist-change';
import { sortedOrder } from './playlist-item-sort';
import {
  appendRows,
  deleteRow,
  lockPlaylist,
  removedOf,
  storedItems,
  touchPlaylist,
} from './playlist-item-writes';
import {
  publicPlaylistsOf,
  reorderSlots,
  sortedItems,
  toPlaylist,
  toStoredItem,
  writePositions,
} from './playlist-query';
import { detailOf, ownedBy, seatedOf } from './playlist-reads';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v } = schema;

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
    viewer: UserContext | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>> {
    return await fromPromise(
      () => detailOf(this.db, id, viewer),
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

  async update(
    id: string,
    patch: PlaylistPatch,
    actorId: string
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .update(p)
            .set({ ...patch, updatedAt: sql`now()` })
            .where(eq(p.id, id))
            .returning();
          if (!row) return null;
          await recordPlaylistChange(tx, id, actorId, [
            { action: 'settings_changed', target: { fields: Object.keys(patch) } },
          ]);
          return toPlaylist(row);
        }),
      databaseUnavailable.during('updatePlaylist')
    );
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
    item: NewPlaylistItem,
    actorId: string
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>> {
    const appended = await this.appendItems(playlistId, [item], actorId);
    return map(appended, (outcomes) => (outcomes ? (outcomes.get(item.id) ?? 'present') : 'playlist-missing'));
  }

  async appendItems(
    playlistId: string,
    items: readonly NewPlaylistItem[],
    actorId: string
  ): Promise<Result<Map<string, AppendItemOutcome> | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (!(await lockPlaylist(tx, playlistId))) return null;
          return await appendLogged(tx, playlistId, items, actorId);
        }),
      databaseUnavailable.during('appendPlaylistItems')
    );
  }

  async removeItem(
    playlistId: string,
    target: PlaylistItemTarget,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (!(await lockPlaylist(tx, playlistId))) return false;
          const removed = await deleteRow(tx, playlistId, target);
          if (!removed) return false;
          await touchPlaylist(tx, playlistId);
          await recordPlaylistChange(tx, playlistId, actorId, [
            { action: 'item_removed', target: removedOf(removed) },
          ]);
          return true;
        }),
      databaseUnavailable.during('removePlaylistItem')
    );
  }

  async editItem(
    playlistId: string,
    itemId: string,
    patch: PlaylistItemPatch,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const edited = await tx
            .update(pi)
            .set(patch)
            .where(and(eq(pi.playlistId, playlistId), eq(pi.id, itemId)))
            .returning({ id: pi.id });
          if (edited.length === 0) return false;
          await touchPlaylist(tx, playlistId);
          await recordPlaylistChange(tx, playlistId, actorId, [
            { action: 'note_edited', target: { itemId } },
          ]);
          return true;
        }),
      databaseUnavailable.during('editPlaylistItem')
    );
  }

  async addSection(
    playlistId: string,
    section: NewPlaylistSection,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (!(await lockPlaylist(tx, playlistId))) return false;
          await appendRows(tx, playlistId, [{ kind: 'section', ...section }]);
          await touchPlaylist(tx, playlistId);
          await recordPlaylistChange(tx, playlistId, actorId, [
            { action: 'section_added', target: { itemId: section.id, title: section.title } },
          ]);
          return true;
        }),
      databaseUnavailable.during('addPlaylistSection')
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
          if (!(await lockPlaylist(tx, playlistId))) return ok(false);
          const writes = plan(await reorderSlots(tx, playlistId, viewer));
          if (isErr(writes)) return writes;
          await writePositions(tx, playlistId, writes.value);
          await logReorder(tx, playlistId, viewer.id, writes.value.length);
          return ok(true);
        }),
      databaseUnavailable.during('reorderPlaylist')
    );
    return andThen(outcome, (decided) => decided);
  }

  async writeSort(
    playlistId: string,
    sort: Exclude<PlaylistItemSort, 'manual'>,
    viewer: UserContext
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          if (!(await lockPlaylist(tx, playlistId))) return false;
          const order = await sortedOrder(tx, playlistId, sort, viewer);
          await writePositions(tx, playlistId, renumberPositions(order));
          await logReorder(tx, playlistId, viewer.id, order.length);
          return true;
        }),
      databaseUnavailable.during('sortPlaylist')
    );
  }

  async transfer(
    sourceId: string,
    targetId: string,
    items: readonly StoredPlaylistItem[],
    mode: 'move' | 'copy',
    actorId: string
  ): Promise<Result<TransferOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => transferRows(tx, sourceId, targetId, items, mode, actorId)),
      databaseUnavailable.during('transferPlaylistItems')
    );
  }

  async restoreItem(
    playlistId: string,
    activity: RestorablePlaylistActivity,
    actorId: string
  ): Promise<Result<RestoreItemOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => restoreRow(tx, playlistId, activity, actorId)),
      databaseUnavailable.during('restorePlaylistItem')
    );
  }
}
