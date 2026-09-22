import { CaslAuthorizationAdapter } from '@vp/adapters';
import { DEFAULT_CDN_BASE_URL } from '@vp/env-schema';
import type { AuthorizationPort } from '@vp/core/ports';
import type {
  EventRepository,
  RenditionRecord,
  RenditionRepository,
  VideoRepository,
} from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import { canReadVideo } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';
import { playbackUrl } from './video-views';

export interface SseSnapshot {
  data: Record<string, unknown>;
  lastEventId: number;
}

export interface SseReplayEvent {
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
  snapshot(): Promise<SseSnapshot>;
  replay(afterId: number): Promise<SseReplayEvent[]>;
}

export interface SseServiceDeps {
  videos: VideoRepository;
  renditions: RenditionRepository;
  events: EventRepository;
  cdnBaseUrl?: string;
  authorization?: AuthorizationPort;
}

export function mapEventToSse(record: {
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
  private readonly videos: VideoRepository;
  private readonly renditions: RenditionRepository;
  private readonly events: EventRepository;
  private readonly cleanCdnBase: string;
  private readonly auth: AuthorizationPort;

  constructor(deps: SseServiceDeps) {
    this.videos = deps.videos;
    this.renditions = deps.renditions;
    this.events = deps.events;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
    const cdnBase = deps.cdnBaseUrl || process.env['CDN_BASE_URL'] || DEFAULT_CDN_BASE_URL;
    this.cleanCdnBase = cdnBase.replace(/\/+$/, '');
  }

  /**
   * Authorises a single-video stream exactly as GET /v1/videos/:id does.
   */
  async openVideoStream(user: AuthUser | null, videoId: string): Promise<SseSession> {
    const video = await this.videos.findById(videoId);
    if (!video) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    if (!this.auth.can(canReadVideo, { user: user, video })) {
      if (!user) {
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required to view private video'
        );
      }
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    return {
      channel: videoChannel(videoId),
      ...(user ? { userId: user.id } : {}),
      snapshot: async () => {
        const [renditions, lastEventId] = await Promise.all([
          this.renditions.findByVideoId(videoId).catch(() => []),
          this.events.getLatestEventId(videoId).catch(() => 0),
        ]);

        const url = playbackUrl(video, this.cleanCdnBase);
        return {
          lastEventId,
          data: {
            videoId,
            status: video.status,
            progress: renditionProgress(video.status === 'READY', renditions),
            ...(url ? { playbackUrl: url } : {}),
          },
        };
      },
      replay: (afterId) =>
        this.events.findAfterId(videoId, afterId).then((rows) => rows.map(mapEventToSse)),
    };
  }

  openUserStream(user: AuthUser): SseSession {
    return {
      channel: userChannel(user.id),
      userId: user.id,
      snapshot: async () => ({
        lastEventId: 0,
        data: {
          userId: user.id,
          status: 'SUBSCRIBED',
          progress: { overall: 0, byRendition: {} },
        },
      }),
      replay: (afterId) =>
        this.events.findAfterIdForUser(user.id, afterId).then((rows) => rows.map(mapEventToSse)),
    };
  }
}
