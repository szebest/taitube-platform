import { getChannel, listChannelPlaylists, listChannelVideos } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  const { channelService } = app.services;

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    getChannel.path,
    {
      schema: {
        ...contractSchema(getChannel),
        params: getChannel.params,
      },
    },
    async (request, reply) => {
      return sendResult(
        reply,
        request,
        await channelService.getPublicChannel(request.params.idOrHandle)
      );
    }
  );

  typedApp.get(
    listChannelVideos.path,
    {
      schema: {
        ...contractSchema(listChannelVideos),
        params: listChannelVideos.params,
        querystring: listChannelVideos.query,
      },
    },
    async (request, reply) => {
      return sendResult(
        reply,
        request,
        await channelService.listVideos(request.params.idOrHandle, request.query)
      );
    }
  );

  typedApp.get(
    listChannelPlaylists.path,
    {
      schema: {
        ...contractSchema(listChannelPlaylists),
        params: listChannelPlaylists.params,
        querystring: listChannelPlaylists.query,
      },
    },
    async (request, reply) => {
      return sendResult(
        reply,
        request,
        await channelService.listPlaylists(request.params.idOrHandle, request.query)
      );
    }
  );
}
