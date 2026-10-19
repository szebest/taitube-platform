import { LastEventIdSchema, streamMyEvents, streamVideoEvents } from '@vp/api-contracts';
import { isErr } from '@vp/result';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { SseHub } from '../services/sse-hub';
import type { SseSession } from '../services/sse-service';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
} as const;

function resumeFrom(request: FastifyRequest, query: string | undefined): number | null {
  const parsed = LastEventIdSchema.safeParse(request.headers['last-event-id'] ?? query);
  return parsed.success ? Number(parsed.data) : null;
}

/**
 * Registration subscribes before any state is read, and the opening is read before the 200 goes
 * out, so a failure on either still renders as a `Problem` rather than as a half-open stream. The
 * hub is already subscribed once the process has started; `init()` is then a no-op, and in a
 * process nobody started it is what keeps a stream from opening onto a silent hub.
 */
async function stream(
  hub: SseHub,
  session: SseSession,
  afterId: number | null,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | undefined> {
  const subscribed = await hub.init();
  if (isErr(subscribed)) return sendResult(reply, request, subscribed);

  const registered = hub.register({
    channel: session.channel,
    userId: session.userId,
    resync: session.resync,
    rawResponse: reply.raw,
  });
  if (isErr(registered)) return sendResult(reply, request, registered);

  const connection = registered.value;
  const opening = await session.open(afterId);
  if (isErr(opening)) {
    connection.close();
    return sendResult(reply, request, opening);
  }

  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) reply.raw.setHeader(name, value);
  }
  reply.raw.writeHead(200, SSE_HEADERS);
  reply.raw.flushHeaders?.();

  for (const frame of opening.value.frames) connection.sendOpening(frame);
  connection.markLive(opening.value.lastEventId);
  return undefined;
}

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  const { sseHub, sseService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(streamVideoEvents)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(streamVideoEvents, { hide }),
          params: streamVideoEvents.params,
          querystring: streamVideoEvents.query,
        },
      },
      async (request, reply) => {
        const session = await sseService.openVideoStream(request.user ?? null, request.params.id);
        if (isErr(session)) return sendResult(reply, request, session);

        const afterId = resumeFrom(request, request.query?.['last-event-id']);
        return stream(sseHub, session.value, afterId, request, reply);
      }
    );
  }

  for (const { path, hide } of contractPaths(streamMyEvents)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(streamMyEvents, { hide }),
          querystring: streamMyEvents.query,
        },
      },
      async (request, reply) => {
        const session = sseService.openUserStream(requireAuth(request));
        const afterId = resumeFrom(request, request.query?.['last-event-id']);
        return stream(sseHub, session, afterId, request, reply);
      }
    );
  }
}
