import { getChannel } from '@vp/api-contracts';
import type { Repositories } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ChannelService } from '../services/channel-service';
import { contractSchema } from './contract-schema';

export interface ChannelsRoutesOptions {
  repositories?: Repositories;
  channelService?: ChannelService;
}

/**
 * Fastify routes plugin for public creator channel profiles (Ticket 38, SDD §6.1).
 * Thin transport adapter delegating domain operations to ChannelService.
 */
export function registerChannelsRoutes(app: FastifyInstance, options: ChannelsRoutesOptions): void {
  const channelService =
    options.channelService ??
    (options.repositories
      ? new ChannelService({
          users: options.repositories.users,
          channels: options.repositories.channels,
        })
      : undefined);

  if (!channelService) {
    throw new Error('registerChannelsRoutes requires either channelService or repositories');
  }

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
