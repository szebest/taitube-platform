import { type Result, andThen, err, fromPromise, isErr, map, ok } from '@kit/result';
import type {
  AddPlaylistItemOutcome,
  AppendItemOutcome,
  NewPlaylistItem,
  NewPlaylistSection,
  PlaylistItemTarget,
  PlaylistRepositoryPort,
  ReorderPlan,
  RestoreItemOutcome,
  MergeOutcome,
  MergeSource,
  TransferOutcome,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type NewPlaylistInput,
  type Playlist,
  type PlaylistItemPatch,
  type PlaylistItemSort,
  type PlaylistPatch,
  type RestorablePlaylistActivity,
  type StoredPlaylistItem,
  WATCH_LATER_TITLE,
  renumberPositions,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { and, eq, sql } from 'drizzle-orm';
import {
  appendLogged,
  logReorder,
  mergeRows,
  restoreRow,
  transferRows,
} from './playlist-bulk-writes';
import { recordPlaylistChange } from './playlist-change';
import { sortedOrder } from './playlist-item-sort';
import {
  appendRows,
  deleteRow,
  lockPlaylist,
  removedOf,
  touchPlaylist,
} from './playlist-item-writes';
import { reorderSlots, toPlaylist, writePositions } from './playlist-query';
import { PostgresPlaylistReads } from './postgres-playlist-reads';

const { playlists: p, playlistItems: pi } = schema;

export class PostgresPlaylistRepository
  extends PostgresPlaylistReads
  implements PlaylistRepositoryPort
{
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
    return map(appended, (outcomes) =>
      outcomes ? (outcomes.get(item.id) ?? 'present') : 'playlist-missing'
    );
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

  async merge(
    targetId: string,
    sources: readonly MergeSource[],
    actorId: string
  ): Promise<Result<MergeOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => mergeRows(tx, targetId, sources, actorId)),
      databaseUnavailable.during('mergePlaylists')
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
