import { type Result, isErr, ok } from '@kit/result';
import type {
  AddPlaylistItemOutcome,
  AppendItemOutcome,
  MergeOutcome,
  MergeSource,
  NewPlaylistItem,
  NewPlaylistSection,
  PlaylistItemTarget,
  PlaylistRepositoryPort,
  ReorderPlan,
  RestoreItemOutcome,
  TransferOutcome,
} from '@vp/core/repositories';
import {
  type Playlist,
  type PlaylistItemPatch,
  type PlaylistItemSort,
  type PlaylistPatch,
  type RestorablePlaylistActivity,
  type StoredPlaylistItem,
  renumberPositions,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import {
  type NewRow,
  SORT_ORDER,
  compareSorted,
  copyOf,
  landedWhole,
  removedOf,
  restoredRow,
} from './in-memory-playlist-items';
import { InMemoryPlaylistReads } from './in-memory-playlist-reads';
import { watchableVideo } from './watchable-video';

/** Every write logs its change and tells the people on the playlist through the seats it was given. */
export class InMemoryPlaylistRepository
  extends InMemoryPlaylistReads
  implements PlaylistRepositoryPort
{
  async update(
    id: string,
    patch: PlaylistPatch,
    actorId: string
  ): Promise<Result<Playlist | null, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!playlist) return ok(null);
    Object.assign(playlist, patch, { updatedAt: new Date() });
    const logged = await this.log(id, actorId, [
      { action: 'settings_changed', target: { fields: Object.keys(patch) } },
    ]);
    return isErr(logged) ? logged : ok({ ...playlist });
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const playlist = this.playlists.get(id);
    if (!playlist || playlist.isSystem) return ok(false);
    this.playlists.delete(id);
    for (const item of this.itemsOf(id)) this.items.delete(item.id);
    this.deps.seats().forget(id);
    return ok(true);
  }

  async addItem(
    playlistId: string,
    item: NewPlaylistItem,
    actorId: string
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>> {
    const appended = await this.appendItems(playlistId, [item], actorId);
    if (isErr(appended)) return appended;
    return ok(appended.value ? (appended.value.get(item.id) ?? 'present') : 'playlist-missing');
  }

  async appendItems(
    playlistId: string,
    items: readonly NewPlaylistItem[],
    actorId: string
  ): Promise<Result<Map<string, AppendItemOutcome> | null, DatabaseUnavailable>> {
    if (!this.playlists.has(playlistId)) return ok(null);
    const outcomes = await this.appendRows(
      playlistId,
      items.map((item): NewRow => ({ kind: 'video', ...item }))
    );
    const added = items.filter((item) => outcomes.get(item.id) === 'added');
    const logged = await this.log(
      playlistId,
      actorId,
      added.map(({ id, videoId }) => ({ action: 'item_added', target: { itemId: id, videoId } }))
    );
    return isErr(logged) ? logged : ok(outcomes);
  }

  async removeItem(
    playlistId: string,
    target: PlaylistItemTarget,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const item = this.itemsOf(playlistId).find((held) =>
      target.by === 'item' ? held.id === target.itemId : held.videoId === target.videoId
    );
    if (!item) return ok(false);
    this.items.delete(item.id);
    const logged = await this.log(playlistId, actorId, [
      { action: 'item_removed', target: removedOf(item) },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async editItem(
    playlistId: string,
    itemId: string,
    patch: PlaylistItemPatch,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const item = this.items.get(itemId);
    if (item?.playlistId !== playlistId) return ok(false);
    this.items.set(itemId, { ...item, ...patch });
    const logged = await this.log(playlistId, actorId, [
      { action: 'note_edited', target: { itemId } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async addSection(
    playlistId: string,
    section: NewPlaylistSection,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.playlists.has(playlistId)) return ok(false);
    await this.appendRows(playlistId, [{ kind: 'section', ...section }]);
    const logged = await this.log(playlistId, actorId, [
      { action: 'section_added', target: { itemId: section.id, title: section.title } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async reorder<F>(
    playlistId: string,
    viewer: UserContext,
    plan: ReorderPlan<F>
  ): Promise<Result<boolean, DatabaseUnavailable | F>> {
    if (!this.playlists.has(playlistId)) return ok(false);
    const slots = await Promise.all(
      this.itemsOf(playlistId).map(async ({ id, position, kind, videoId }) => ({
        id,
        position,
        hidden: kind === 'video' && !(await watchableVideo(this.deps, viewer, videoId ?? '')),
      }))
    );
    const writes = plan(slots);
    if (isErr(writes)) return writes;
    this.write(writes.value);
    const logged = await this.log(playlistId, viewer.id, [
      { action: 'items_reordered', target: { count: writes.value.length } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async writeSort(
    playlistId: string,
    sort: Exclude<PlaylistItemSort, 'manual'>,
    viewer: UserContext
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.playlists.has(playlistId)) return ok(false);
    const order = SORT_ORDER[sort];
    const videos = (await this.keyedVideos(playlistId, sort, viewer, false))
      .sort((a, b) => compareSorted(a, b, order))
      .map((row) => row.id);
    const sections = this.itemsOf(playlistId)
      .filter((item) => item.kind === 'section')
      .map((item) => item.id);
    const all = [...videos, ...sections];
    this.write(renumberPositions(all));
    const logged = await this.log(playlistId, viewer.id, [
      { action: 'items_reordered', target: { count: all.length } },
    ]);
    return isErr(logged) ? logged : ok(true);
  }

  async transfer(
    sourceId: string,
    targetId: string,
    items: readonly StoredPlaylistItem[],
    mode: 'move' | 'copy',
    actorId: string
  ): Promise<Result<TransferOutcome, DatabaseUnavailable>> {
    if (!this.playlists.has(targetId)) return ok(null);
    const held = new Set(this.itemsOf(sourceId).map((item) => item.id));
    const moving = items.filter((item) => held.has(item.id));
    const copies = new Map(moving.map((item) => [item.id, copyOf(item, actorId, uuidv7())]));
    const appended = await this.appendRows(targetId, [...copies.values()]);
    const outcomeOf = (item: StoredPlaylistItem) =>
      appended.get(copies.get(item.id)?.id ?? '') ?? 'added';

    const added = moving.flatMap((item) => {
      const copy = copies.get(item.id);
      return outcomeOf(item) === 'added' && copy?.kind === 'video'
        ? [{ action: 'item_added' as const, target: { itemId: copy.id, videoId: copy.videoId } }]
        : [];
    });
    const loggedIn = await this.log(targetId, actorId, added);
    if (isErr(loggedIn)) return loggedIn;
    if (mode === 'move') {
      const leaving = moving.filter((item) => outcomeOf(item) !== 'video-missing');
      for (const item of leaving) this.items.delete(item.id);
      const loggedOut = await this.log(
        sourceId,
        actorId,
        leaving.map((item) => ({ action: 'item_removed' as const, target: removedOf(item) }))
      );
      if (isErr(loggedOut)) return loggedOut;
    }
    return ok(
      new Map(
        items.map((item) => [item.id, held.has(item.id) ? outcomeOf(item) : 'source-missing'])
      )
    );
  }

  async merge(
    targetId: string,
    sources: readonly MergeSource[],
    actorId: string
  ): Promise<Result<MergeOutcome, DatabaseUnavailable>> {
    const outcomes = new Map<string, NonNullable<TransferOutcome>>();
    for (const { sourceId, items, deleteIfLanded } of sources) {
      const outcome = await this.transfer(sourceId, targetId, items, 'copy', actorId);
      if (isErr(outcome)) return outcome;
      if (outcome.value === null) return ok(null);
      outcomes.set(sourceId, outcome.value);
      if (deleteIfLanded && landedWhole(outcome.value)) {
        const removed = await this.remove(sourceId);
        if (isErr(removed)) return removed;
      }
    }
    return ok(outcomes);
  }

  async restoreItem(
    playlistId: string,
    activity: RestorablePlaylistActivity,
    actorId: string
  ): Promise<Result<RestoreItemOutcome, DatabaseUnavailable>> {
    if (!this.playlists.has(playlistId)) return ok('playlist-missing');
    if (this.restored.has(activity.id)) return ok('present');
    const row = restoredRow(activity.target, uuidv7());
    const outcome = (await this.appendRows(playlistId, [row])).get(row.id) ?? 'added';
    if (outcome !== 'added') return ok(outcome);
    this.restored.add(activity.id);
    const logged = await this.log(playlistId, actorId, [
      { action: 'restored', target: { activityId: activity.id, itemId: row.id } },
    ]);
    return isErr(logged) ? logged : ok('restored');
  }
}
