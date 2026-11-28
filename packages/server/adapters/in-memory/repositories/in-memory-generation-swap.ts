import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, ok, type Result } from '@kit/result';
import type {
  EventRepository,
  SwapGenerationInput,
  UserEventRepository,
  SwapOutcome,
  VideoRecord,
  VideoViewRepositoryPort,
} from '@vp/core/repositories';
import {
  type Correction,
  EDIT_BASE_RETENTION_MS,
  type GenerationPlayback,
  type GenerationTimeline,
  RETIRED_GENERATION_GRACE_MS,
  type RetentionPoint,
  type VideoEdit,
  type VideoGeneration,
  drifted,
  shiftTimeline,
  videoGenerationUpdated,
} from '@vp/domain';
import { RENDERABLE_STATUSES, VIDEO_GENERATION } from '@vp/domain-rules';
import { uuidv7 } from 'uuidv7';
import type { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';

export type StoredGeneration = VideoGeneration & { lockToken: string | null };

export interface SwapStores {
  generations: Map<string, StoredGeneration>;
  edits: Map<string, VideoEdit>;
  videos: { getAllVideos(): VideoRecord[] };
  chapters: Pick<InMemoryVideoChapterRepository, 'chaptersOf' | 'replace'>;
  corrections: {
    correctionsOf(videoId: string): Correction[];
    replaceFor(videoId: string, corrections: readonly Correction[]): void;
  };
  retention: Pick<VideoViewRepositoryPort, 'retentionCurve'> & {
    replaceRetention(videoId: string, points: readonly RetentionPoint[]): void;
  };
  events: Pick<EventRepository, 'create'>;
  userEvents: Pick<UserEventRepository, 'append'>;
}

export const generationKey = (videoId: string, generation: number) => `${videoId}|${generation}`;

export const toGenerationRecord = ({ lockToken: _held, ...row }: StoredGeneration) => ({ ...row });

function playbackOf(video: VideoRecord): GenerationPlayback | null {
  if (!video.masterPlaylistKey || video.durationMs === null) return null;
  return {
    masterPlaylistKey: video.masterPlaylistKey,
    durationMs: video.durationMs,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: video.fps ?? null,
    ladder: video.ladder,
  };
}

function holds(stored: StoredGeneration | undefined, input: SwapGenerationInput): boolean {
  if (!stored) return false;
  const { claim } = input;
  return claim.type === 'render'
    ? VIDEO_GENERATION.sources('swap').includes(stored.status) &&
        stored.lockToken === claim.lockToken
    : VIDEO_GENERATION.sources('restore').includes(stored.status) &&
        stored.purgeAfter !== null &&
        stored.purgeAfter > input.now;
}

/** The in-memory twin of `commitGenerationSwap`: the same checks and writes, without a transaction. */
export async function swapInMemory(
  stores: SwapStores,
  input: SwapGenerationInput
): Promise<Result<SwapOutcome, DatabaseUnavailable>> {
  const { videoId, generation, claim, now } = input;
  const incoming = stores.generations.get(generationKey(videoId, generation));
  if (!incoming || !holds(incoming, input)) return ok({ type: 'fenced' });

  const video = stores.videos.getAllVideos().find(({ id }) => id === videoId);
  const current =
    claim.type === 'render'
      ? video?.generation === incoming.replacesGeneration
      : video?.version === claim.expectedVersion;
  const playback = claim.type === 'render' ? claim.playback : incoming.playback;
  if (!video || !RENDERABLE_STATUSES.includes(video.status) || !current || !playback) {
    return ok({ type: 'superseded' });
  }

  const outgoing = video.generation;
  const keepsBase = incoming.kind === 'edit' && claim.type === 'render';
  const timeline: GenerationTimeline = {
    chapters: stores.chapters.chaptersOf(videoId),
    corrections: stores.corrections
      .correctionsOf(videoId)
      .map(({ startMs, endMs, text }) => ({ startMs, endMs, text })),
  };
  const retired = stores.generations.get(generationKey(videoId, outgoing));
  const curve = await stores.retention.retentionCurve(videoId);
  if (isErr(curve)) return curve;
  const retention = curve.value;
  const outgoingRow: StoredGeneration = {
    videoId,
    generation: outgoing,
    kind: retired?.kind ?? 'upload',
    sourceKey: retired?.sourceKey ?? null,
    baseGeneration: retired?.baseGeneration ?? null,
    replacesGeneration: retired?.replacesGeneration ?? outgoing,
    needsReview: retired?.needsReview ?? false,
    errorCode: retired?.errorCode ?? null,
    createdAt: retired?.createdAt ?? now,
    lockToken: null,
    status: 'retired',
    playback: playbackOf(video),
    timeline,
    retention,
    purgeAfter: new Date(
      now.getTime() +
        (keepsBase && outgoing === incoming.baseGeneration
          ? EDIT_BASE_RETENTION_MS
          : RETIRED_GENERATION_GRACE_MS)
    ),
    updatedAt: now,
  };
  stores.generations.set(generationKey(videoId, outgoing), outgoingRow);
  const base =
    incoming.baseGeneration === null
      ? undefined
      : stores.generations.get(generationKey(videoId, incoming.baseGeneration));
  if (keepsBase && base) base.purgeAfter = new Date(now.getTime() + EDIT_BASE_RETENTION_MS);

  stores.retention.replaceRetention(
    videoId,
    claim.type === 'revert' ? (incoming.retention ?? []) : []
  );
  const edit = stores.edits.get(videoId);
  const nextTimeline =
    claim.type === 'revert'
      ? incoming.timeline
      : keepsBase && base?.timeline
        ? shiftTimeline(base.timeline, edit?.trim ?? null)
        : null;
  if (nextTimeline) {
    stores.chapters.replace(videoId, nextTimeline.chapters);
    stores.corrections.replaceFor(
      videoId,
      nextTimeline.corrections.map((c) => ({ ...c, id: uuidv7(), videoId, createdAt: now }))
    );
  }

  Object.assign(video, { ...playback, generation, version: video.version + 1, updatedAt: now });
  Object.assign(incoming, {
    status: 'active',
    lockToken: null,
    purgeAfter: null,
    playback,
    needsReview:
      incoming.kind === 'replacement' &&
      drifted(outgoingRow.playback?.durationMs ?? null, playback.durationMs),
    updatedAt: now,
  });
  if (edit && (incoming.kind === 'edit' || claim.type === 'revert')) {
    Object.assign(edit, {
      status: claim.type === 'revert' ? 'reverted' : 'applied',
      updatedAt: now,
    });
  }
  const recorded = await stores.events.create({
    videoId,
    type: 'video.replaced',
    payload: {
      generation,
      previousGeneration: outgoing,
      kind: claim.type === 'revert' ? 'revert' : incoming.kind,
    },
  });
  if (isErr(recorded)) return recorded;
  const announced = await stores.userEvents.append({
    userId: video.ownerId,
    ...videoGenerationUpdated({ videoId, generation, status: 'active' }),
  });
  if (isErr(announced)) return announced;
  return ok({ type: 'swapped', version: video.version });
}
