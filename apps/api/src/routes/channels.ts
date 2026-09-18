import type { Repositories } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { problemResponse } from '../schemas/problem';
import { ChannelService } from '../services/channel-service';

export interface ChannelsRoutesOptions {
  repositories?: Repositories;
  channelService?: ChannelService;
}

const channelResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  subscriberCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const channelParamsSchema = z.object({
  idOrHandle: z.string().min(1),
});

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

  // GET /v1/channels/:idOrHandle
  typedApp.get(
    '/v1/channels/:idOrHandle',
    {
      schema: {
        tags: ['Channels'],
        summary: 'Get public creator channel profile',
        description:
          'Returns public channel details, subscriber count, avatar, banner, and bio by channel UUID or @handle.',
        params: channelParamsSchema,
        response: {
          200: channelResponseSchema,
          400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
          404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
        },
      },
    },
    async (request, reply) => {
      const channel = await channelService.getPublicChannel(request.params.idOrHandle);
      return reply.status(200).send(channel);
    }
  );
}
