import type { Repositories } from '@vp/core/ports';
import { verifyDevToken } from '@vp/dev-token';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuthUser } from '../plugins/auth.js';
import type { SseHub } from '../services/sse-hub.js';

export interface EventsRouteOptions {
  sseHub: SseHub;
  repositories: Repositories;
  cdnBaseUrl?: string;
}

function extractUser(request: FastifyRequest): AuthUser | null {
  if (request.user) {
    return request.user;
  }
  const tokenQuery = (request.query as Record<string, string> | undefined)?.['token'];
  if (tokenQuery) {
    try {
      const payload = verifyDevToken(tokenQuery);
      return {
        id: payload.sub,
        role: payload.role || 'user',
      };
    } catch {
      return null;
    }
  }
  return null;
}

function mapEventToSse(record: { id: number; type: string; payload: unknown }): {
  event: string;
  data: unknown;
} {
  let sseEvent = 'status';
  let data = record.payload as any;

  if (record.type === 'progress') {
    sseEvent = 'progress';
  } else if (record.type === 'video.ready') {
    sseEvent = 'status';
    data = {
      status: 'READY',
      playbackUrl: data?.playbackUrl,
    };
  } else if (record.type === 'video.failed' || record.type === 'probe.failed') {
    sseEvent = 'status';
    data = {
      status: 'FAILED',
      error: {
        code: data?.errorCode || 'FAILED',
        message: data?.errorMessage || '',
      },
    };
  } else if (record.type === 'video.processing' || record.type === 'probe.completed') {
    sseEvent = 'status';
    data = { status: 'PROCESSING' };
  } else if (record.type === 'probe.started') {
    sseEvent = 'status';
    data = { status: 'PROBING' };
  }

  return { event: sseEvent, data };
}

export function registerEventsRoutes(app: FastifyInstance, options: EventsRouteOptions): void {
  const { sseHub, repositories } = options;
  const cdnBase =
    options.cdnBaseUrl || process.env['CDN_BASE_URL'] || 'http://localhost:9000/public';
  const cleanCdnBase = cdnBase.replace(/\/+$/, '');

  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /v1/videos/:id/events (SDD §10.1, §10.2, AC 1-6)
  server.get(
    '/v1/videos/:id/events',
    {
      schema: {
        params: z.object({
          id: z.string().uuid({ message: 'Invalid video ID format' }),
        }),
        querystring: z
          .object({
            token: z.string().optional(),
            'last-event-id': z.string().optional(),
          })
          .optional(),
      },
    },
    async (request, reply) => {
      const { id: videoId } = request.params;
      const user = extractUser(request);

      // 1. Authorise identically to GET /v1/videos/:id (SDD §6.1, §11, AC 2)
      const video = await repositories.videos.findById(videoId);
      if (!video) {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
      }

      if (video.visibility === 'private') {
        if (!user) {
          throw new PermanentError(
            ErrorCodes.UNAUTHORIZED,
            'Authentication required to view private video'
          );
        }
        if (user.id !== video.ownerId && user.role !== 'admin') {
          throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
        }
      }

      // 2. Subscribe FIRST before reading DB snapshot to close any gap (SDD §10.2, AC 2)
      const connection = sseHub.register({
        channel: videoChannel(videoId),
        userId: user?.id,
        rawResponse: reply.raw,
      });

      // 3. Hijack raw response and set SSE headers (SDD §10.1)
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      reply.raw.flushHeaders?.();

      // 4. Query DB for snapshot and latest event ID
      const [renditions, latestEventId] = await Promise.all([
        repositories.renditions.findByVideoId(videoId).catch(() => []),
        repositories.events.getLatestEventId(videoId).catch(() => 0),
      ]);

      const isReady = video.status === 'READY';
      const byRendition: Record<string, number> = {};
      for (const r of renditions) {
        byRendition[r.name] = r.status === 'DONE' ? 100 : 0;
      }
      const doneCount = renditions.filter((r) => r.status === 'DONE').length;
      const overall = isReady
        ? 100
        : renditions.length > 0
          ? Math.round((doneCount * 100) / renditions.length)
          : 0;

      const snapshotData: Record<string, unknown> = {
        videoId,
        status: video.status,
        progress: {
          overall,
          byRendition,
        },
      };

      if (isReady) {
        const key = video.masterPlaylistKey || `videos/${videoId}/hls/master.m3u8`;
        snapshotData['playbackUrl'] = `${cleanCdnBase}/${key.replace(/^\/+/, '')}`;
      }

      connection.sendSnapshot(snapshotData, latestEventId);

      // 5. Replay missed events if Last-Event-ID header is present (AC 3)
      const lastEventIdHeader =
        request.headers['last-event-id'] ||
        (request.query as Record<string, string> | undefined)?.['last-event-id'];

      let lastSentId = latestEventId;
      if (lastEventIdHeader) {
        const afterId = Number.parseInt(String(lastEventIdHeader), 10);
        if (!Number.isNaN(afterId)) {
          const missed = await repositories.events.findAfterId(videoId, afterId);
          for (const ev of missed) {
            const mapped = mapEventToSse(ev);
            connection.sendReplayEvent(ev.id, mapped.event, mapped.data);
            lastSentId = Math.max(lastSentId, ev.id);
          }
        }
      }

      // 6. Transition to live with deduplication of buffered events
      connection.markLive(lastSentId);
    }
  );

  // GET /v1/me/events (SDD §10.2, PRD FR-8)
  server.get(
    '/v1/me/events',
    {
      schema: {
        querystring: z
          .object({
            token: z.string().optional(),
            'last-event-id': z.string().optional(),
          })
          .optional(),
      },
    },
    async (request, reply) => {
      const user = extractUser(request);
      if (!user) {
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required to subscribe to personal event stream'
        );
      }

      const connection = sseHub.register({
        channel: userChannel(user.id),
        userId: user.id,
        rawResponse: reply.raw,
      });

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      reply.raw.flushHeaders?.();

      connection.sendSnapshot({
        userId: user.id,
        status: 'SUBSCRIBED',
        progress: { overall: 0, byRendition: {} },
      });

      const lastEventIdHeader =
        request.headers['last-event-id'] ||
        (request.query as Record<string, string> | undefined)?.['last-event-id'];

      let lastSentId = 0;
      if (lastEventIdHeader) {
        const afterId = Number.parseInt(String(lastEventIdHeader), 10);
        if (!Number.isNaN(afterId)) {
          const missed = await repositories.events.findAfterIdForUser(user.id, afterId);
          for (const ev of missed) {
            const mapped = mapEventToSse(ev);
            connection.sendReplayEvent(ev.id, mapped.event, mapped.data);
            lastSentId = Math.max(lastSentId, ev.id);
          }
        }
      }

      connection.markLive(lastSentId);
    }
  );
}
