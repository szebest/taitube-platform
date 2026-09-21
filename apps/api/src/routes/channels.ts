import { getChannel } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { ChannelService } from '../services/channel-service';
import { contractSchema } from './contract-schema';

export interface ChannelsRoutesOptions {
  channelService: ChannelService;
}

/**
 * Fastify routes plugin for public creator channel profiles (Ticket 38, SDD §6.1).
 * Thin transport adapter delegating domain operations to ChannelService.
 */
export function registerChannelsRoutes(app: FastifyInstance, options: ChannelsRoutesOptions): void {
  const { channelService } = options;

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
      const channel = await channelService.getPublicChannel(request.params.idOrHandle);
      return reply.status(200).send(channel);
    }
  );
}
