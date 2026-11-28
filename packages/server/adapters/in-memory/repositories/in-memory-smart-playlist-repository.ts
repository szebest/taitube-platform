import { MS_PER_DAY, MS_PER_SECOND } from '@kit/primitives';
import { type Result, assertNever, ok, unwrapOr } from '@kit/result';
import type {
  EvaluateRulesOptions,
  SmartPlaylistEntry,
  SmartPlaylistRepositoryPort,
  WatchHistoryRepositoryPort,
} from '@vp/core/repositories';
import {
  SMART_PLAYLIST_SORT_KEYS,
  SMART_PLAYLIST_VIDEO_FORMATS,
  type SmartPlaylistCondition,
  type SmartPlaylistDuration,
  type SmartPlaylistRules,
  type Video,
  isPublicFeedEligible,
  isWatchCompleted,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type VideoLookups, channelCard } from './watchable-video';

interface SmartPlaylistDeps extends VideoLookups {
  allVideos: () => readonly Video[];
  history: () => Pick<WatchHistoryRepositoryPort, 'findMany'>;
}

function withinDuration(durationMs: number | null, duration: SmartPlaylistDuration): boolean {
  if (durationMs === null) return false;
  switch (duration.op) {
    case 'under':
      return durationMs < duration.seconds * MS_PER_SECOND;
    case 'over':
      return durationMs > duration.seconds * MS_PER_SECOND;
    case 'between':
      return (
        durationMs >= duration.minSeconds * MS_PER_SECOND &&
        durationMs <= duration.maxSeconds * MS_PER_SECOND
      );
    default:
      return assertNever(duration, 'SmartPlaylistDuration');
  }
}

function matches(
  condition: SmartPlaylistCondition,
  video: Video,
  watched: ReadonlySet<string>,
  now: Date
): boolean {
  switch (condition.field) {
    case 'channel':
      return condition.channelIds.includes(video.channelId);
    case 'tag':
      return condition.tags.some((tag) => (video.tags ?? []).includes(tag));
    case 'category':
      return video.categoryId === condition.categoryId;
    case 'duration':
      return withinDuration(video.durationMs ?? null, condition.duration);
    case 'format':
      return video.format === SMART_PLAYLIST_VIDEO_FORMATS[condition.format];
    case 'newer_than':
      return video.createdAt.getTime() >= now.getTime() - condition.days * MS_PER_DAY;
    case 'unwatched':
      return !watched.has(video.id);
    default:
      return assertNever(condition, 'SmartPlaylistCondition');
  }
}

function sortKeyOf(rules: SmartPlaylistRules, video: Video): number {
  const { key } = SMART_PLAYLIST_SORT_KEYS[rules.sort];
  switch (key) {
    case 'createdAt':
      return video.createdAt.getTime();
    case 'views':
      return video.viewsCount ?? 0;
    case 'duration':
      return video.durationMs ?? 0;
    default:
      return assertNever(key, 'SmartPlaylistSortKey');
  }
}

/** The in-memory form of the one query: the same predicate, ranking, limit and keyset. */
export class InMemorySmartPlaylistRepository implements SmartPlaylistRepositoryPort {
  constructor(private readonly deps: SmartPlaylistDeps) {}

  async evaluate(
    rules: SmartPlaylistRules,
    viewer: UserContext | null,
    { cursor, limit, now }: EvaluateRulesOptions
  ): Promise<Result<SmartPlaylistEntry[], DatabaseUnavailable>> {
    const candidates = this.deps.allVideos().filter((video) => isPublicFeedEligible(video));
    const watched = await this.watchedBy(viewer, candidates);
    const kept = candidates.filter((video) => {
      if (rules.conditions.length === 0) return true;
      const hits = rules.conditions.map((condition) => matches(condition, video, watched, now));
      return rules.match === 'all' ? hits.every(Boolean) : hits.some(Boolean);
    });
    const sign = SMART_PLAYLIST_SORT_KEYS[rules.sort].order === 'asc' ? 1 : -1;
    const compare = (a: { key: number; id: string }, b: { key: number; id: string }) =>
      sign * (a.key - b.key || a.id.localeCompare(b.id));
    const ranked = kept
      .map((video) => ({ video, id: video.id, key: sortKeyOf(rules, video) }))
      .sort(compare)
      .slice(0, rules.limit)
      .map((row, position) => ({ ...row, position }));
    const page = ranked
      .filter((row) => cursor === null || compare(row, { key: cursor.key, id: cursor.id }) > 0)
      .slice(0, limit + 1);
    return ok(
      await Promise.all(
        page.map(async ({ video, key, position }) => ({
          video,
          key,
          position,
          channel: await channelCard(this.deps, video.channelId),
        }))
      )
    );
  }

  clear(): void {}

  private async watchedBy(
    viewer: UserContext | null,
    videos: readonly Video[]
  ): Promise<Set<string>> {
    if (!viewer) return new Set();
    const ids = videos.map((video) => video.id);
    const progress = unwrapOr(await this.deps.history().findMany(viewer.id, ids), []);
    return new Set(progress.filter(isWatchCompleted).map((playhead) => playhead.videoId));
  }
}
