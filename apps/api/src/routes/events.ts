import { streamMyEvents, streamVideoEvents } from '@vp/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { SseHub } from '../services/sse-hub';
import type { SseService, SseSession } from '../services/sse-service';
import { contractSchema } from './contract-schema';

export interface EventsRouteOptions {
  sseHub: SseHub;
  sseService: SseService;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
} as const;

function resumeFrom(request: FastifyRequest): number | null {
  const header =
    request.headers['last-event-id'] ??
    (request.query as Record<string, string> | undefined)?.['last-event-id'];
  if (header === undefined) return null;

  const afterId = Number.parseInt(String(header), 10);
  return Number.isNaN(afterId) ? null : afterId;
}

async function stream(
  hub: SseHub,
  session: SseSession,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const connection = hub.register({
    channel: session.channel,
    ...(session.userId ? { userId: session.userId } : {}),
    rawResponse: reply.raw,
  });

  reply.raw.writeHead(200, SSE_HEADERS);
  reply.raw.flushHeaders?.();

  const snapshot = await session.snapshot();
  connection.sendSnapshot(snapshot.data, snapshot.lastEventId);

  let lastSentId = snapshot.lastEventId;
  const afterId = resumeFrom(request);
  if (afterId !== null) {
    for (const event of await session.replay(afterId)) {
      connection.sendReplayEvent(event.id, event.event, event.data);
      lastSentId = Math.max(lastSentId, event.id);
    }
  }

  connection.markLive(lastSentId);
}

export function registerEventsRoutes(app: FastifyInstance, options: EventsRouteOptions): void {
  const { sseHub, sseService } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const path of ['/v1/videos/:id/events', '/videos/:id/events'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(streamVideoEvents, { hide: path === '/videos/:id/events' }),
          params: streamVideoEvents.params,
          querystring: streamVideoEvents.query,
        },
      },
      async (request, reply) => {
        const session = await sseService.openVideoStream(request.user ?? null, request.params.id);
        await stream(sseHub, session, request, reply);
      }
    );
  }

  for (const path of ['/v1/me/events', '/me/events'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(streamMyEvents, { hide: path === '/me/events' }),
          querystring: streamMyEvents.query,
        },
      },
      async (request, reply) => {
        const session = sseService.openUserStream(requireAuth(request));
        await stream(sseHub, session, request, reply);
      }
    );
  }
}
