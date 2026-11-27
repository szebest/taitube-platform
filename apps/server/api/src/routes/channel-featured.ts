import { getChannelFeatured, setChannelFeatured } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelFeaturedRoutes(app: FastifyInstance): Promise<void> {
  const { channelFeaturedService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getChannelFeatured.path,
    { schema: { ...contractSchema(getChannelFeatured), params: getChannelFeatured.params } },
    async (request, reply) =>
      sendResult(reply, request, await channelFeaturedService.get(request.params.idOrHandle))
  );

  server.put(
    setChannelFeatured.path,
    { schema: { ...contractSchema(setChannelFeatured), body: setChannelFeatured.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelFeaturedService.replace(user, acting, request.body.videoIds)
      );
    }
  );
}
