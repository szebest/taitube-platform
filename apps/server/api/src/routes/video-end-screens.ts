import { map } from '@kit/result';
import {
  getCreatorVideoEndScreen,
  getVideoEndScreen,
  replaceVideoEndScreen,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function videoEndScreenRoutes(app: FastifyInstance): Promise<void> {
  const { videoEndScreenService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getVideoEndScreen.path,
    { schema: { ...contractSchema(getVideoEndScreen), params: getVideoEndScreen.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await videoEndScreenService.read(request.user ?? null, request.params.id)
      )
  );

  server.get(
    getCreatorVideoEndScreen.path,
    {
      schema: {
        ...contractSchema(getCreatorVideoEndScreen),
        params: getCreatorVideoEndScreen.params,
      },
    },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        map(await videoEndScreenService.readForEditing(user, request.params.id), (endScreen) => ({
          endScreen,
        }))
      );
    }
  );

  server.put(
    replaceVideoEndScreen.path,
    {
      schema: {
        ...contractSchema(replaceVideoEndScreen),
        params: replaceVideoEndScreen.params,
        body: replaceVideoEndScreen.body,
      },
    },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await videoEndScreenService.replace(user, request.params.id, request.body)
      );
    }
  );
}
