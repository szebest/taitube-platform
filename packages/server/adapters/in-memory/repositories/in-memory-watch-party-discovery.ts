import { type Result, ok, unwrapOr } from '@kit/result';
import type {
  DiscoverableRoom,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import {
  type Channel,
  SEARCH_RANKING,
  WATCH_PARTY_SIZE_LIMITS,
  type WatchPartyDiscoveryFilters,
  type WatchPartyDiscoveryPosition,
  type WatchPartyDiscoveryQuery,
  type WatchPartyRoom,
  effectiveCapacity,
  isPublicFeedEligible,
  memberKeyOf,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';
import { lexicalScore, wordSimilarity } from './search-text';

export interface DiscoveryLookups {
  videosRepo: { getAllVideos(): VideoRecord[] };
  channelsRepo: { getAllChannels(): Channel[] };
  subscriptionsRepo: Pick<SubscriptionRepositoryPort, 'getUserSubscriptionChannelIds'>;
}

interface Candidate {
  readonly room: WatchPartyRoom;
  readonly video: VideoRecord | null;
  readonly searchText: string;
  readonly trendScore: number;
}

function matchesText(query: WatchPartyDiscoveryQuery, { room, searchText }: Candidate): boolean {
  const { text } = query.filters;
  if (text === null) return true;
  switch (query.mode) {
    case 'lexical':
      return (
        lexicalScore(text, [
          { text: room.name, weight: 'A' },
          { text: searchText, weight: 'B' },
        ]) > 0
      );
    case 'fuzzy':
      return wordSimilarity(text, searchText) >= SEARCH_RANKING.fuzzyThreshold;
  }
}

function matchesStatus(
  status: WatchPartyDiscoveryFilters['status'],
  { phase, scheduledFor }: WatchPartyRoom,
  now: Date
): boolean {
  const future = scheduledFor !== null && scheduledFor > now;
  switch (status) {
    case 'all':
      return true;
    case 'now':
      return phase === 'playing' || phase === 'paused';
    case 'lobby':
      return phase === 'lobby' && !future;
    case 'scheduled':
      return phase === 'lobby' && future;
  }
}

function matchesSize(size: WatchPartyDiscoveryFilters['size'], present: number): boolean {
  const { small, medium } = WATCH_PARTY_SIZE_LIMITS;
  switch (size) {
    case 'any':
      return true;
    case 'small':
      return present <= small;
    case 'medium':
      return present > small && present <= medium;
    case 'large':
      return present > medium;
  }
}

function matchesKind(kind: WatchPartyDiscoveryFilters['kind'], queueLength: number): boolean {
  switch (kind) {
    case 'any':
      return true;
    case 'single':
      return queueLength === 1;
    case 'playlist':
      return queueLength > 1;
  }
}

function matchesAccess(access: WatchPartyDiscoveryFilters['access'], hasPassword: boolean) {
  switch (access) {
    case 'any':
      return true;
    case 'open':
      return !hasPassword;
    case 'password':
      return hasPassword;
  }
}

function keyOf(room: Candidate, sort: WatchPartyDiscoveryPosition['sort']): number {
  switch (sort) {
    case 'members':
      return room.room.presentCount;
    case 'newest':
      return room.room.createdAt.getTime();
    case 'starting_soon':
      return room.room.scheduledFor?.getTime() ?? 0;
    case 'trending':
      return room.trendScore;
  }
}

function positionKey(position: WatchPartyDiscoveryPosition): number {
  return typeof position.key === 'number' ? position.key : position.key.getTime();
}

const byId = (a: Candidate, b: Candidate) => (a.room.id < b.room.id ? -1 : 1);

function sorted(candidates: Candidate[], sort: WatchPartyDiscoveryPosition['sort']): Candidate[] {
  const direction = sort === 'starting_soon' ? 1 : -1;
  return candidates.sort((a, b) => direction * (keyOf(a, sort) - keyOf(b, sort)) || byId(a, b));
}

function isAfter(candidate: Candidate, after: WatchPartyDiscoveryPosition): boolean {
  const key = keyOf(candidate, after.sort);
  const bound = positionKey(after);
  const beyond = after.sort === 'starting_soon' ? key > bound : key < bound;
  return beyond || (key === bound && candidate.room.id > after.id);
}

/** The in-memory form of `watchPartyListScope` and the discovery filters, over the shared store. */
export async function discoverableRooms(
  store: InMemoryWatchPartyStore,
  lookups: DiscoveryLookups,
  query: WatchPartyDiscoveryQuery
): Promise<Result<DiscoverableRoom[], DatabaseUnavailable>> {
  const { filters, viewerId, ceiling, now, sort, after, limit } = query;
  const videos = new Map(lookups.videosRepo.getAllVideos().map((video) => [video.id, video]));
  const viewerKey = viewerId === null ? null : memberKeyOf({ kind: 'user', userId: viewerId });
  const banned = new Set(
    [...store.bans.values()]
      .filter(({ memberKey }) => memberKey === viewerKey)
      .map(({ roomId }) => roomId)
  );
  const subscribed = new Set(
    viewerId !== null && filters.followed
      ? unwrapOr(await lookups.subscriptionsRepo.getUserSubscriptionChannelIds(viewerId), [])
      : []
  );
  const followedChannels = lookups.channelsRepo
    .getAllChannels()
    .filter((channel) => subscribed.has(channel.id));
  const isFollowed = (room: WatchPartyRoom): boolean => {
    const seated = new Set(
      [...store.members.values()]
        .filter((seat) => seat.roomId === room.id && seat.leftAt === null)
        .flatMap(({ userId }) => userId ?? [])
    );
    return followedChannels.some(
      (channel) =>
        channel.id === room.asChannelId ||
        room.ownerKey === memberKeyOf({ kind: 'user', userId: channel.userId }) ||
        seated.has(channel.userId)
    );
  };

  const candidates = [...store.rooms.values()]
    .map((room): Candidate => ({
      room,
      video: room.currentVideoId === null ? null : (videos.get(room.currentVideoId) ?? null),
      searchText: store.searchTexts.get(room.id) ?? '',
      trendScore: store.trendScores.get(room.id) ?? 0,
    }))
    .filter((candidate) => {
      const { room, video } = candidate;
      const listed =
        room.status === 'open' &&
        room.visibility === 'public' &&
        room.hiddenAt === null &&
        !banned.has(room.id) &&
        (room.currentVideoId === null || (video !== null && isPublicFeedEligible(video)));
      return (
        listed &&
        (sort !== 'starting_soon' || room.scheduledFor !== null) &&
        matchesStatus(filters.status, room, now) &&
        (filters.categoryId === null || video?.categoryId === filters.categoryId) &&
        (filters.language === null || room.language === filters.language) &&
        matchesAccess(filters.access, room.passwordHash !== null) &&
        matchesSize(filters.size, room.presentCount) &&
        (!filters.space || room.presentCount < effectiveCapacity(room.capacity, ceiling)) &&
        (!filters.followed || viewerId === null || isFollowed(room)) &&
        (!filters.creator || room.asChannelId !== null) &&
        matchesKind(filters.kind, room.queueLength) &&
        matchesText(query, candidate)
      );
    });

  const page = sorted(candidates, sort)
    .filter((candidate) => after === null || isAfter(candidate, after))
    .slice(0, limit + 1);
  return ok(
    page.map(({ room, video, trendScore }) => ({
      room: { ...room, playback: { ...room.playback } },
      categoryId: video?.categoryId ?? null,
      trendScore,
    }))
  );
}
