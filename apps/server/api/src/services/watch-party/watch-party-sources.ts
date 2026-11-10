import type { CreateWatchPartyBody } from '@vp/api-contracts';
import type { NewWatchPartyQueueItem } from '@vp/core/repositories';
import { WATCH_PARTY_LIMITS, type WatchPartyVisibility } from '@vp/domain';
import { decideWatchPartyShareable, type ShareableVideo } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyVideoNotShareable,
  watchPartyVideoNotShareable,
} from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { all, andThenAsync, assertNever, err, map, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';

type RoomSource = NonNullable<CreateWatchPartyBody['source']>;
type PlaylistSource = Extract<RoomSource, { playlistId: string }>;
type ListSource = Extract<RoomSource, { videoIds: string[] }>;

interface LooseSource {
  readonly videoId?: string;
  readonly startMs?: number;
  readonly playlistId?: string;
  readonly videoIds?: string[];
  readonly startIndex?: number;
}

/** The contract's three shapes carry no tag, so each is told apart by the one key only it holds. */
function isPlaylist(source: RoomSource): source is PlaylistSource {
  const loose: LooseSource = source;
  return loose.playlistId !== undefined;
}

function isList(source: RoomSource): source is ListSource {
  const loose: LooseSource = source;
  return loose.videoIds !== undefined;
}

type SourcePlan =
  | { readonly type: 'video'; readonly videoId: string; readonly startMs: number }
  | { readonly type: 'playlist'; readonly playlistId: string }
  | { readonly type: 'videos'; readonly videoIds: readonly string[]; readonly subjectId: string };

function planOf(source: RoomSource): SourcePlan {
  if (isPlaylist(source)) return { type: 'playlist', playlistId: source.playlistId };
  if (isList(source)) {
    return {
      type: 'videos',
      videoIds: source.videoIds.slice(source.startIndex ?? 0),
      subjectId: source.videoIds.at(-1) ?? '',
    };
  }
  return { type: 'video', videoId: source.videoId, startMs: source.startMs ?? 0 };
}

function subjectOf(plan: SourcePlan): string {
  switch (plan.type) {
    case 'video':
      return plan.videoId;
    case 'playlist':
      return plan.playlistId;
    case 'videos':
      return plan.subjectId;
    default:
      return assertNever(plan, 'SourcePlan');
  }
}

interface Candidate {
  readonly videoId: string;
  readonly video: (ShareableVideo & { readonly title: string | null }) | null;
  readonly startMs: number;
}

export interface RoomQueueSeed {
  readonly items: NewWatchPartyQueueItem[];
  readonly firstTitle: string | null;
}

export interface SourceAsk {
  readonly roomId: string;
  readonly ownerKey: string;
  readonly actor: UserContext;
  readonly visibility: WatchPartyVisibility;
}

type SourceDeps = Pick<WatchPartyDeps, 'repositories' | 'secrets' | 'now'>;
type SourceFailure = WatchPartyVideoNotShareable | DatabaseUnavailable;

async function candidatesOf(
  { repositories }: SourceDeps,
  actor: UserContext,
  plan: SourcePlan
): Promise<Result<Candidate[], SourceFailure>> {
  switch (plan.type) {
    case 'video':
      return map(await repositories.videos.findById(plan.videoId), (video) => [
        { videoId: plan.videoId, video, startMs: plan.startMs },
      ]);
    case 'videos': {
      const found = await Promise.all(
        plan.videoIds.map(async (videoId) =>
          map(await repositories.videos.findById(videoId), (video) => ({
            videoId,
            video,
            startMs: 0,
          }))
        )
      );
      return all(found);
    }
    case 'playlist': {
      const detail = await repositories.playlists.findDetail(plan.playlistId, actor);
      return map(detail, (found) =>
        (found?.items ?? []).map(({ videoId, video }) => ({ videoId, video, startMs: 0 }))
      );
    }
    default:
      return assertNever(plan, 'SourcePlan');
  }
}

/**
 * The videos the room may play, in order. A playlist or a list gives up the ones it may not share
 * and plays on; a lone video is refused outright; a source with nothing left is refused with the
 * first reason found.
 */
export async function resolveSource(
  deps: SourceDeps,
  { roomId, ownerKey, actor, visibility }: SourceAsk,
  source: RoomSource | undefined
): Promise<Result<RoomQueueSeed, SourceFailure>> {
  if (source === undefined) return ok({ items: [], firstTitle: null });

  const plan = planOf(source);
  const loaded = await candidatesOf(deps, actor, plan);
  return andThenAsync(loaded, (candidates): Result<RoomQueueSeed, SourceFailure> => {
    const decided = candidates.map((candidate) => ({
      candidate,
      verdict: decideWatchPartyShareable(candidate.videoId, candidate.video, visibility),
    }));
    const kept = decided
      .filter(({ verdict }) => verdict.ok)
      .map(({ candidate }) => candidate)
      .slice(0, WATCH_PARTY_LIMITS.queueItems);
    const [first] = kept;
    if (first === undefined) {
      const refused = decided.flatMap(({ verdict }) => (verdict.ok ? [] : [verdict.error]));
      return err(refused[0] ?? watchPartyVideoNotShareable(subjectOf(plan), 'missing'));
    }
    return ok({
      items: kept.map((candidate) => ({
        id: deps.secrets.newId(),
        roomId,
        videoId: candidate.videoId,
        addedBy: ownerKey,
        startMs: candidate.startMs,
        createdAt: deps.now(),
      })),
      firstTitle: first.video?.title ?? null,
    });
  });
}
