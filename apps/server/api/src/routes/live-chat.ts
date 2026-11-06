import { liveChatSocket } from '@vp/api-contracts';
import { isErr, isOk } from '@vp/result';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { LiveChatSession } from '../services/live-chat-service';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { sendSocketResult } from './send-socket-result';
import { keepAlive } from './socket-keepalive';

const SERVER_ERROR = 1011;

export async function liveChatRoutes(app: FastifyInstance): Promise<void> {
  const { liveChatService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();
  const sessions = new WeakMap<FastifyRequest, LiveChatSession>();

  server.get(
    liveChatSocket.path,
    {
      websocket: true,
      schema: {
        ...contractSchema(liveChatSocket),
        params: liveChatSocket.params,
        querystring: liveChatSocket.query,
      },
      preHandler: async (request, reply) => {
        const opened = await liveChatService.open({
          liveStreamId: request.params.id,
          ticket: request.query?.ticket,
          origin: request.headers.origin,
        });
        if (isErr(opened)) return sendResult(reply, request, opened);
        sessions.set(request, opened.value);
      },
    },
    (socket, request) => {
      const session = sessions.get(request);
      if (!session) return socket.close(SERVER_ERROR);

      const send = keepAlive(socket, app.config.live.chat);
      const connecting = liveChatService.connect(session, request.query?.after ?? null, send);
      socket.on('message', async (raw) => {
        const connection = await connecting;
        if (!isOk(connection)) return;
        const { ref, result } = await connection.value.receive(String(raw));
        sendSocketResult(socket, request.url, result, ref);
      });
      socket.on('close', async () => {
        const connection = await connecting;
        if (isOk(connection)) connection.value.leave();
      });
      void connecting.then((connection) => {
        if (isOk(connection)) return;
        sendSocketResult(socket, request.url, connection);
        socket.close(SERVER_ERROR);
      });
    }
  );
}
