import { getAccount, updateMyChannel } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { ChannelService } from '../services/channel-service';
import { contractSchema } from './contract-schema';

export interface MeRoutesOptions {
  channelService: ChannelService;
}

/**
 * Fastify routes plugin for user identity and channel account management (Ticket 38, SDD §6.1).
 * Thin transport adapter delegating domain operations to ChannelService.
 */
export function registerMeRoutes(app: FastifyInstance, options: MeRoutesOptions): void {
  const { channelService } = options;

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
