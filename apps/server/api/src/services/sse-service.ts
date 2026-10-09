import type {
  EventRepository,
  RenditionRecord,
  RenditionRepository,
  VideoRepository,
} from '@vp/core/repositories';
import { type ReadVideoFailure, decideVideoRead, publicReadFailure } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok, unwrapOr } from '@vp/result';
import { playbackUrl } from './video-views';

interface SseSnapshot {
  data: Record<string, unknown>;
  lastEventId: number;
}

interface SseReplayEvent {
  id: number;
  event: string;
  data: unknown;
}

/**
 * A stream the caller has already been cleared for. `snapshot()` stays deferred
 * so the transport can subscribe to the channel before reading state — the
 * other order drops every event published in between.
 */
export interface SseSession {
  channel: string;
  userId?: string;
  snapshot(): Promise<Result<SseSnapshot, DatabaseUnavailable>>;
  replay(afterId: number): Promise<Result<SseReplayEvent[], DatabaseUnavailable>>;
}

export interface SseServiceDeps {
  videos: VideoRepository;
  renditions: RenditionRepository;
  events: EventRepository;
  cdn: CdnBase;
}

export type OpenVideoStreamFailure = ReadVideoFailure | DatabaseUnavailable;

function mapEventToSse(record: {
  id: number;
  type: string;
  payload: unknown;
}): SseReplayEvent {
  const payload =
    record.payload && typeof record.payload === 'object'
      ? (record.payload as Record<string, unknown>)
      : undefined;

  switch (record.type) {
    case 'progress':
      return { id: record.id, event: 'progress', data: record.payload };
    case 'video.ready':
      return { id: record.id, event: 'status', data: { status: 'READY' } };
    case 'video.failed':
      return {
        id: record.id,
        event: 'status',
        data: {
          status: 'FAILED',
          error: {
            code: (payload?.['errorCode'] as string) || 'FAILED',
            message: (payload?.['errorMessage'] as string) || '',
          },
        },
      };
    case 'video.processing':
    case 'probe.completed':
      return { id: record.id, event: 'status', data: { status: 'PROCESSING' } };
    case 'probe.started':
      return { id: record.id, event: 'status', data: { status: 'PROBING' } };
    default:
      return { id: record.id, event: 'status', data: record.payload };
  }
}

function renditionProgress(
  isReady: boolean,
  renditions: RenditionRecord[]
): { overall: number; byRendition: Record<string, number> } {
  const byRendition: Record<string, number> = {};
  for (const rendition of renditions) {
    byRendition[rendition.name] = rendition.status === 'DONE' ? 100 : 0;
  }

  if (isReady) {
    return { overall: 100, byRendition };
  }

  const done = renditions.filter((rendition) => rendition.status === 'DONE').length;
  const overall = renditions.length > 0 ? Math.round((done * 100) / renditions.length) : 0;
  return { overall, byRendition };
}

/**
 * SseService — assembles the state an event stream opens with and the events it
 * replays. Connection lifecycle, backpressure and fan-out stay in SseHub.
 */
export class SseService {
  constructor(private readonly deps: SseServiceDeps) {}

  /**
   * Authorises a single-video stream exactly as GET /v1/videos/:id does.
   */
  async openVideoStream(
    user: UserContext | null,
    videoId: string
  ): Promise<Result<SseSession, OpenVideoStreamFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoRead({ viewer: user, video: found.value, videoId });
    if (isErr(decided)) return err(publicReadFailure(decided.error));
    const video = decided.value;

    return ok({
      channel: videoChannel(videoId),
      ...(user ? { userId: user.id } : {}),
      // A snapshot that cannot read the renditions or the event id still opens the stream on what
      // the video row already said; the live events that follow carry the rest.
      snapshot: async () => {
        const renditions = unwrapOr(await this.deps.renditions.findByVideoId(videoId), []);
        const lastEventId = unwrapOr(await this.deps.events.getLatestEventId(videoId), 0);
        const url = playbackUrl(video, this.deps.cdn);

        return ok({
          lastEventId,
          data: {
            videoId,
            status: video.status,
            progress: renditionProgress(video.status === 'READY', renditions),
            ...(url ? { playbackUrl: url } : {}),
          },
        });
      },
      replay: async (afterId) =>
        map(await this.deps.events.findAfterId(videoId, afterId), (rows) =>
          rows.map(mapEventToSse)
        ),
    });
  }

  openUserStream(user: UserContext): SseSession {
    return {
      channel: userChannel(user.id),
      userId: user.id,
      snapshot: async () =>
        ok({
          lastEventId: 0,
          data: {
            userId: user.id,
            status: 'SUBSCRIBED',
            progress: { overall: 0, byRendition: {} },
          },
        }),
      replay: async (afterId) =>
        map(await this.deps.events.findAfterIdForUser(user.id, afterId), (rows) =>
          rows.map(mapEventToSse)
        ),
    };
  }
}
