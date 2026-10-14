import { streamMyEvents, streamVideoEvents } from '@vp/api-contracts';
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

function resumeFrom(request: FastifyRequest): number | null {
  const header =
    request.headers['last-event-id'] ??
    (request.query as Record<string, string> | undefined)?.['last-event-id'];
  if (header === undefined) return null;

  const afterId = Number.parseInt(String(header), 10);
  return Number.isNaN(afterId) ? null : afterId;
}

/**
 * Registration subscribes before any state is read, and the snapshot is taken before the 200 goes
 * out, so a failure on either still renders as a `Problem` rather than as a half-open stream. The
 * hub is already subscribed once the process has started; `init()` is then a no-op, and in a
 * process nobody started it is what keeps a stream from opening onto a silent hub.
 */
async function stream(
  hub: SseHub,
  session: SseSession,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | undefined> {
  const subscribed = await hub.init();
  if (isErr(subscribed)) return sendResult(reply, request, subscribed);

  const registered = hub.register({
    channel: session.channel,
    userId: session.userId,
    rawResponse: reply.raw,
  });
  if (isErr(registered)) return sendResult(reply, request, registered);

  const connection = registered.value;
  const snapshot = await session.snapshot();
  if (isErr(snapshot)) {
    connection.close();
    return sendResult(reply, request, snapshot);
  }

  const afterId = resumeFrom(request);
  const replayed = afterId === null ? null : await session.replay(afterId);
  if (replayed && isErr(replayed)) {
    connection.close();
    return sendResult(reply, request, replayed);
  }

  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) reply.raw.setHeader(name, value);
  }
  reply.raw.writeHead(200, SSE_HEADERS);
  reply.raw.flushHeaders?.();

  connection.sendSnapshot(snapshot.value.data, snapshot.value.lastEventId);

  let lastSentId = snapshot.value.lastEventId;
  for (const event of replayed?.value ?? []) {
    connection.sendReplayEvent(event.id, event.event, event.data);
    lastSentId = Math.max(lastSentId, event.id);
  }

  connection.markLive(lastSentId);
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

        return stream(sseHub, session.value, request, reply);
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
        return stream(sseHub, session, request, reply);
      }
    );
  }
}
