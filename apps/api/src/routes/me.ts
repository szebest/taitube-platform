import { getAccount, updateMyChannel } from '@vp/api-contracts';
import type { Repositories } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { ChannelService } from '../services/channel-service';
import { contractSchema } from './contract-schema';

export interface MeRoutesOptions {
  repositories?: Repositories;
  channelService?: ChannelService;
}

/**
 * Fastify routes plugin for user identity and channel account management (Ticket 38, SDD §6.1).
 * Thin transport adapter delegating domain operations to ChannelService.
 */
export function registerMeRoutes(app: FastifyInstance, options: MeRoutesOptions): void {
  const channelService =
    options.channelService ??
    (options.repositories
      ? new ChannelService({
          users: options.repositories.users,
          channels: options.repositories.channels,
        })
      : undefined);

  if (!channelService) {
    throw new Error('registerMeRoutes requires either channelService or repositories');
  }

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    getAccount.path,
    {
      schema: {
        ...contractSchema(getAccount),
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const authUser = requireAuth(request);
      const result = await channelService.getAccount(authUser.id);
      return reply.status(200).send(result);
    }
  );

  typedApp.patch(
    updateMyChannel.path,
    {
      schema: {
        ...contractSchema(updateMyChannel),
        security: [{ bearerAuth: [] }],
        body: updateMyChannel.body,
      },
    },
    async (request, reply) => {
      const authUser = requireAuth(request);
      const updated = await channelService.updateChannel(authUser.id, request.body);
      return reply.status(200).send(updated);
    }
  );
}
