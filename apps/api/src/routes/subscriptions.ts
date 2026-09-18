import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { problemResponse } from '../schemas/problem';
import {
  ChannelSubscriberParamsSchema,
  IsSubscribedResponseSchema,
  ListSubscriptionsQuerySchema,
  ListSubscriptionsResponseSchema,
  SubscribeResponseSchema,
  SubscriptionFeedQuerySchema,
  UnsubscribeResponseSchema,
} from '../schemas/subscriptions';
import { FeedResponseSchema } from '../schemas/videos';
import type { SubscriptionService } from '../services/subscription-service';

export interface SubscriptionsRouteOptions {
  subscriptionService: SubscriptionService;
}

/**
 * Fastify routes plugin for channel subscriptions & subscriber video feed (Ticket 41, SDD §6.1).
 * Thin transport adapter delegating subscription operations to SubscriptionService.
 */
export function registerSubscriptionsRoutes(
  app: FastifyInstance,
  options: SubscriptionsRouteOptions
): void {
  const { subscriptionService } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  // 1. POST /v1/channels/:id/subscribers (subscribe to channel)
  for (const path of ['/v1/channels/:id/subscribers', '/channels/:id/subscribers'] as const) {
    const isAlias = path === '/channels/:id/subscribers';
    server.post(
      path,
      {
        schema: {
          tags: ['Subscriptions'],
          summary: 'Subscribe to channel',
          description:
            'Idempotently subscribes the authenticated caller to the channel. Increments subscriber count and updates Redis cache.',
          params: ChannelSubscriberParamsSchema,
          response: {
            200: SubscribeResponseSchema,
            400: problemResponse(
              [ErrorCodes.VALIDATION_FAILED, ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF],
              'Bad request or cannot subscribe to own channel'
            ),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        request.authorize('channel:subscribe');
        const result = await subscriptionService.subscribe(user, request.params.id);
        return reply.status(200).send(result);
      }
    );
  }

  // 2. DELETE /v1/channels/:id/subscribers (unsubscribe from channel)
  for (const path of ['/v1/channels/:id/subscribers', '/channels/:id/subscribers'] as const) {
    const isAlias = path === '/channels/:id/subscribers';
    server.delete(
      path,
      {
        schema: {
          tags: ['Subscriptions'],
          summary: 'Unsubscribe from channel',
          description:
            'Idempotently unsubscribes the authenticated caller from the channel. Decrements subscriber count and updates Redis cache.',
          params: ChannelSubscriberParamsSchema,
          response: {
            200: UnsubscribeResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.unsubscribe(user, request.params.id);
        return reply.status(200).send(result);
      }
    );
  }

  // 3. GET /v1/channels/:id/subscribers/me (check subscription status)
  for (const path of [
    '/v1/channels/:id/subscribers/me',
    '/channels/:id/subscribers/me',
  ] as const) {
    const isAlias = path === '/channels/:id/subscribers/me';
    server.get(
      path,
      {
        schema: {
          tags: ['Subscriptions'],
          summary: 'Check if authenticated caller is subscribed to channel',
          description:
            'Checks whether the caller subscribes to the channel. Served with sub-millisecond latency via Redis set.',
          params: ChannelSubscriberParamsSchema,
          response: {
            200: IsSubscribedResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            404: problemResponse([ErrorCodes.CHANNEL_NOT_FOUND], 'Channel not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.isSubscribed(user, request.params.id);
        return reply.status(200).send(result);
      }
    );
  }

  // 4. GET /v1/me/subscriptions (list subscribed channels)
  for (const path of ['/v1/me/subscriptions', '/me/subscriptions'] as const) {
    const isAlias = path === '/me/subscriptions';
    server.get(
      path,
      {
        schema: {
          tags: ['Subscriptions'],
          summary: 'List channels current user is subscribed to',
          description:
            'Returns keyset-paginated list of channels the current authenticated user subscribes to, newest first.',
          querystring: ListSubscriptionsQuerySchema,
          response: {
            200: ListSubscriptionsResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.listSubscriptions(user, request.query);
        return reply.status(200).send(result);
      }
    );
  }

  // 5. GET /v1/feed/subscriptions (subscribed channels video feed)
  for (const path of ['/v1/feed/subscriptions', '/feed/subscriptions'] as const) {
    const isAlias = path === '/feed/subscriptions';
    server.get(
      path,
      {
        schema: {
          tags: ['Subscriptions'],
          summary: 'Subscribed channels video feed',
          description:
            'Keyset-paginated list of READY and public videos published by channels the user subscribes to, sorted newest first.',
          querystring: SubscriptionFeedQuerySchema,
          response: {
            200: FeedResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.getFeed(user, request.query);
        return reply.status(200).send(result);
      }
    );
  }
}
