import {
  getChannel,
  getChannelSpotlight,
  listChannelPlaylists,
  listChannelVideos,
  revealChannelContact,
} from '@vp/api-contracts';
import { CONTACT_REVEALS_PER_DAY } from '@vp/domain';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { localeChainOf } from '../services/locale-chain';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  const { channelService, channelIdentityService, channelSpotlightService } = app.services;

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    getChannel.path,
    {
      schema: {
        ...contractSchema(getChannel),
        params: getChannel.params,
        querystring: getChannel.query,
      },
    },
    async (request, reply) => {
      const locales = localeChainOf(request.query.locale, request.headers['accept-language']);
      reply.header('vary', 'Accept-Language');
      return sendResult(
        reply,
        request,
        await channelService.getPublicChannel(request.params.idOrHandle, locales)
      );
    }
  );

  typedApp.get(
    getChannelSpotlight.path,
    {
      schema: {
        ...contractSchema(getChannelSpotlight),
        params: getChannelSpotlight.params,
        querystring: getChannelSpotlight.query,
      },
    },
    async (request, reply) => {
      const locales = localeChainOf(request.query.locale, request.headers['accept-language']);
      reply.header('vary', 'Accept-Language, Authorization');
      reply.header('cache-control', 'private, no-cache');
      return sendResult(
        reply,
        request,
        await channelSpotlightService.get(request.user ?? null, request.params.idOrHandle, locales)
      );
    }
  );

  typedApp.post(
    revealChannelContact.path,
    {
      config: {
        rateLimit: {
          max: CONTACT_REVEALS_PER_DAY,
          timeWindow: '1 day',
          keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
        },
      },
      schema: {
        ...contractSchema(revealChannelContact),
        security: [{ bearerAuth: [] }],
        params: revealChannelContact.params,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      return sendResult(
        reply,
        request,
        await channelIdentityService.revealContact(request.params.id)
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
