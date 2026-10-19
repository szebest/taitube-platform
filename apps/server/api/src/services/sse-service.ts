import { type StreamResume, UserEventFrameSchema } from '@vp/api-contracts';
import type {
  EventRepository,
  RenditionRecord,
  RenditionRepository,
  UserEventRecord,
  UserEventRepository,
  VideoRepository,
} from '@vp/core/repositories';
import { type ReadVideoFailure, decideVideoRead, publicReadFailure } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import type { Logger } from '@vp/logger';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok, unwrapOr } from '@vp/result';
import type { SseFrame } from './sse-connection';
import { helloFrame, userFrame } from './sse-frames';
import { playbackUrl } from './video-views';

interface SseOpening {
  frames: SseFrame[];
  lastEventId: number;
}

/**
 * A stream the caller has already been cleared for. `open()` stays deferred so the transport can
 * subscribe to the channel before reading state: the other order drops every event published in
 * between. `afterId` is the client's `Last-Event-ID`, `null` on a first connect.
 */
export interface SseSession {
  channel: string;
  userId?: string;
  open(afterId: number | null): Promise<Result<SseOpening, DatabaseUnavailable>>;
  resync?(afterId: number): Promise<Result<SseFrame[], DatabaseUnavailable>>;
}

export interface SseServiceDeps {
  videos: VideoRepository;
  renditions: RenditionRepository;
  events: EventRepository;
  userEvents: UserEventRepository;
  cdn: CdnBase;
  replayLimit: number;
  logger: Logger;
}

export type OpenVideoStreamFailure = ReadVideoFailure | DatabaseUnavailable;

function mapEventToSse(record: { id: number; type: string; payload: unknown }): SseFrame {
  const text = (key: string): string | undefined => {
    const value: unknown =
      record.payload && typeof record.payload === 'object'
        ? Reflect.get(record.payload, key)
        : undefined;
    return typeof value === 'string' && value !== '' ? value : undefined;
  };

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
            code: text('errorCode') ?? 'FAILED',
            message: text('errorMessage') ?? '',
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

function lastIdOf(frames: SseFrame[], from: number): number {
  return frames.reduce((last, frame) => Math.max(last, frame.id ?? 0), from);
}

function userFrames(rows: UserEventRecord[], logger: Logger): SseFrame[] {
  return rows.flatMap((row) => {
    const parsed = UserEventFrameSchema.safeParse({
      id: row.id,
      type: row.type,
      payload: row.payload,
    });
    if (parsed.success) return [userFrame(parsed.data)];

    logger.warn({ id: row.id, type: row.type }, 'dropped a user event the contract does not know');
    return [];
  });
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
      open: async (afterId) => {
        const renditions = unwrapOr(await this.deps.renditions.findByVideoId(videoId), []);
        const lastEventId = unwrapOr(await this.deps.events.getLatestEventId(videoId), 0);
        const url = playbackUrl(video, this.deps.cdn);
        const snapshot: SseFrame = {
          ...(lastEventId > 0 ? { id: lastEventId } : {}),
          event: 'snapshot',
          data: {
            videoId,
            status: video.status,
            progress: renditionProgress(video.status === 'READY', renditions),
            ...(url ? { playbackUrl: url } : {}),
          },
        };
        if (afterId === null) return ok({ frames: [snapshot], lastEventId });

        return map(await this.deps.events.findAfterId(videoId, afterId), (rows) => {
          const frames = [snapshot, ...rows.map(mapEventToSse)];
          return { frames, lastEventId: lastIdOf(frames, 0) };
        });
      },
    });
  }

  openUserStream(user: UserContext): Required<SseSession> {
    const { userEvents, replayLimit } = this.deps;
    const openAtLatest = async (resume: StreamResume) =>
      map(await userEvents.latestId(user.id), (lastEventId) => ({
        frames: [helloFrame(resume)],
        lastEventId,
      }));

    return {
      channel: userChannel(user.id),
      userId: user.id,
      open: async (afterId) => {
        if (afterId === null) return openAtLatest('fresh');

        const rows = await userEvents.listFrom(user.id, afterId, replayLimit + 2);
        if (isErr(rows)) return rows;
        const [seen, ...missed] = rows.value;
        if (seen?.id !== afterId || missed.length > replayLimit) return openAtLatest('expired');

        const frames = userFrames(missed, this.deps.logger);
        return ok({
          frames: [helloFrame('replayed'), ...frames],
          lastEventId: lastIdOf(frames, afterId),
        });
      },
      resync: async (afterId) => {
        const frames: SseFrame[] = [];
        for (let cursor = afterId; ; ) {
          const page = await userEvents.listFrom(user.id, cursor + 1, replayLimit);
          if (isErr(page)) return page;
          frames.push(...userFrames(page.value, this.deps.logger));
          const last = page.value.at(-1);
          if (!last || page.value.length < replayLimit) return ok(frames);
          cursor = last.id;
        }
      },
    };
  }
}
