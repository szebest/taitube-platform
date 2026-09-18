import type { Repositories } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import { problemResponse } from '../schemas/problem';
import { ChannelService } from '../services/channel-service';

export interface MeRoutesOptions {
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

const userAccountResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  tier: z.string(),
  createdAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    tier: z.string(),
    createdAt: z.string(),
  }),
  channel: channelResponseSchema,
});

const updateChannelBodySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  handle: z.string().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
});

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

  // GET /v1/me/account
  typedApp.get(
    '/v1/me/account',
    {
      schema: {
        tags: ['Account'],
        summary: 'Get authenticated user account and channel profile',
        description: 'Returns authenticated user details and associated creator channel.',
        security: [{ bearerAuth: [] }],
        response: {
          200: userAccountResponseSchema,
          401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
          404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
        },
      },
    },
    async (request, reply) => {
      const authUser = requireAuth(request);
      const result = await channelService.getAccount(authUser.id);
      return reply.status(200).send(result);
    }
  );

  // PATCH /v1/me/channel
  typedApp.patch(
    '/v1/me/channel',
    {
      schema: {
        tags: ['Account'],
        summary: 'Update authenticated user channel profile',
        description:
          'Updates handle, display name, avatar, banner, or bio for the authenticated user channel.',
        security: [{ bearerAuth: [] }],
        body: updateChannelBodySchema,
        response: {
          200: channelResponseSchema,
          400: problemResponse(
            [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_HANDLE_FORMAT],
            'Validation error'
          ),
          401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
          404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
          409: problemResponse(
            [ErrorCodes.HANDLE_ALREADY_TAKEN],
            'Handle already taken or reserved'
          ),
        },
      },
    },
    async (request, reply) => {
      const authUser = requireAuth(request);
      const updated = await channelService.updateChannel(authUser.id, request.body);
      return reply.status(200).send(updated);
    }
  );
}
