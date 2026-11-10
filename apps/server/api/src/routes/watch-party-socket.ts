import { createWatchPartySocketTicket, watchPartySocket } from '@vp/api-contracts';
import { isErr, isOk } from '@vp/result';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { RoomSession } from '../services/index';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';
import { sendSocketResult } from './send-socket-result';
import { keepAlive } from './socket-keepalive';

const SERVER_ERROR = 1011;
const NORMAL = 1000;

export async function watchPartySocketRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyService, watchPartySocketService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();
  const sessions = new WeakMap<FastifyRequest, RoomSession>();

  server.post(
    createWatchPartySocketTicket.path,
    {
      schema: {
        ...contractSchema(createWatchPartySocketTicket),
        params: createWatchPartySocketTicket.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.socketTicket(request.params.id, partyCallerOf(request)),
        { status: createWatchPartySocketTicket.status }
      )
  );

  server.get(
    watchPartySocket.path,
    {
      websocket: true,
      schema: {
        ...contractSchema(watchPartySocket),
        params: watchPartySocket.params,
        querystring: watchPartySocket.query,
      },
      preHandler: async (request, reply) => {
        const opened = await watchPartySocketService.open({
          roomId: request.params.id,
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

      const send = keepAlive(socket, app.config.watchParties.socket);
      const connecting = watchPartySocketService.connect(session, request.query?.after ?? null, {
        send,
        end: () => socket.close(NORMAL),
      });
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
