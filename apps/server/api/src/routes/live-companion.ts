import { type LiveCompanionFrame, liveCompanionSocket } from '@vp/api-contracts';
import { isErr } from '@vp/result';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { sendSocketResult } from './send-socket-result';
import { keepAlive } from './socket-keepalive';

export async function liveCompanionRoutes(app: FastifyInstance): Promise<void> {
  const { liveCompanionService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();
  const greetings = new WeakMap<FastifyRequest, LiveCompanionFrame>();

  server.get(
    liveCompanionSocket.path,
    {
      websocket: true,
      schema: { ...contractSchema(liveCompanionSocket), querystring: liveCompanionSocket.query },
      preHandler: async (request, reply) => {
        const hello = await liveCompanionService.open(request.query.token);
        if (isErr(hello)) return sendResult(reply, request, hello);
        greetings.set(request, hello.value);
      },
    },
    (socket, request) => {
      const { token } = request.query;
      const send = keepAlive(socket, app.config.live.chat);
      const hello = greetings.get(request);
      if (hello) send(hello);
      socket.on('message', async (raw) => {
        const { ref, result } = await liveCompanionService.receive(token, String(raw));
        sendSocketResult(socket, request.url, result, ref);
      });
    }
  );
}
