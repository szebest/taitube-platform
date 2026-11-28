import type { Logger } from '@kit/logger';
import { all, isErr, map, ok, type Result } from '@kit/result';
import { type WatchPartyDiscoveryEvent } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { DiscoverableRoom } from '@vp/core/repositories';
import { isOpenWatchParty, isPublicFeedEligible, type WatchPartyRoom } from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { partiesChannel } from '@vp/events';
import type { RoomBatcher } from './room-batcher';
import { type CardDeps, presentCards } from './watch-party-card-views';

export interface WatchPartyDiscoveryFeedDeps extends CardDeps {
  /** One window for the whole pod: the composition root builds it around the flush it is handed. */
  readonly batchCounts: (
    flush: (roomIds: readonly string[]) => Promise<void>
  ) => RoomBatcher<string>;
  readonly cache: Pick<CacheClient, 'publish'>;
  readonly logger: Logger;
}

const COUNTS_WINDOW = 'counts';

/**
 * What discovery's stream sends, from whichever pod made the change: a room opening, changing or
 * closing, and the present counts that moved, batched into one frame a window. Only a room the
 * list would show is ever announced, so the anonymous stream never learns of any other.
 */
export class WatchPartyDiscoveryFeed {
  private readonly counts: RoomBatcher<string>;

  constructor(private readonly deps: WatchPartyDiscoveryFeedDeps) {
    this.counts = deps.batchCounts((roomIds) => this.flushCounts(roomIds));
  }

  opened(room: WatchPartyRoom): Promise<void> {
    return this.announceCard('party.opened', room);
  }

  updated(room: WatchPartyRoom): Promise<void> {
    return this.announceCard('party.updated', room);
  }

  /** A room that stopped being listed, or ended, leaves every open grid. */
  closed(roomId: string): Promise<void> {
    return this.publish({ type: 'party.closed', payload: { id: roomId } });
  }

  /** A settings change moves a room into, within or out of the list. */
  settingsChanged(before: WatchPartyRoom, after: WatchPartyRoom): Promise<void> {
    if (before.visibility === 'public' && after.visibility !== 'public') {
      return this.closed(after.id);
    }
    return before.visibility === 'public' ? this.updated(after) : this.opened(after);
  }

  countChanged(roomId: string): void {
    this.counts.add(COUNTS_WINDOW, roomId);
  }

  close(): void {
    this.counts.close();
  }

  private async announceCard(
    type: 'party.opened' | 'party.updated',
    room: WatchPartyRoom
  ): Promise<void> {
    const listed = await this.listed(room);
    if (isErr(listed)) return this.warn(listed.error, room.id, type);
    if (listed.value === null) return;
    const cards = await presentCards(this.deps, [listed.value]);
    if (isErr(cards)) return this.warn(cards.error, room.id, type);
    const [card] = cards.value;
    if (card) await this.publish({ type, payload: { card } });
  }

  /** The room as the list would show it, or `null` when the list would not. */
  private async listed(
    room: WatchPartyRoom
  ): Promise<Result<DiscoverableRoom | null, DatabaseUnavailable>> {
    if (!isOpenWatchParty(room) || room.visibility !== 'public' || room.hiddenAt !== null) {
      return ok(null);
    }
    if (room.currentVideoId === null) return ok({ room, video: null, trendScore: 0 });
    const video = await this.deps.repositories.videos.findById(room.currentVideoId);
    if (isErr(video)) return video;
    if (video.value === null || !isPublicFeedEligible(video.value)) return ok(null);
    const { id, title, durationMs, customThumbnailKey, posterKey, categoryId } = video.value;
    return ok({
      room,
      video: { id, title, durationMs, customThumbnailKey, posterKey, categoryId },
      trendScore: 0,
    });
  }

  private async countOf(
    roomId: string,
    staleBeforeMs: number
  ): Promise<
    Result<{ id: string; presentCount: number } | null, DatabaseUnavailable | CacheUnavailable>
  > {
    const found = await this.deps.repositories.watchPartyRooms.findById(roomId);
    if (isErr(found)) return found;
    if (found.value === null) return ok(null);
    const listed = await this.listed(found.value);
    if (isErr(listed)) return listed;
    if (listed.value === null) return ok(null);
    const present = await this.deps.presence.members(roomId, staleBeforeMs);
    return map(present, (members) => ({ id: roomId, presentCount: members.length }));
  }

  private async flushCounts(roomIds: readonly string[]): Promise<void> {
    const { config, now } = this.deps;
    const staleBeforeMs = now().getTime() - config.presence.staleAfterMs;
    const counted = all(
      await Promise.all([...new Set(roomIds)].map((roomId) => this.countOf(roomId, staleBeforeMs)))
    );
    if (isErr(counted)) return this.warn(counted.error, null, 'party.counts');
    const counts = counted.value.flatMap((count) => count ?? []);
    if (counts.length > 0) await this.publish({ type: 'party.counts', payload: { counts } });
  }

  private async publish(event: WatchPartyDiscoveryEvent): Promise<void> {
    const sent = await this.deps.cache.publish(partiesChannel(), JSON.stringify(event));
    if (isErr(sent)) this.warn(sent.error, null, event.type);
  }

  private warn(
    error: DatabaseUnavailable | CacheUnavailable,
    roomId: string | null,
    event: string
  ): void {
    this.deps.logger.warn({ err: error, roomId, event }, 'discovery event not published');
  }
}
