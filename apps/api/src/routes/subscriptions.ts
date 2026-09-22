import {
  getSubscriptionFeed,
  isSubscribedToChannel,
  listMySubscriptions,
  subscribeToChannel,
  unsubscribeFromChannel,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { SubscriptionService } from '../services/subscription-service';
import { contractPaths, contractSchema } from './contract-schema';

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

  for (const { path, hide } of contractPaths(subscribeToChannel)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(subscribeToChannel, { hide }),
          params: subscribeToChannel.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.subscribe(user, request.params.id);
        return reply.status(200).send(result);
      }
    );

    server.delete(
      path,
      {
        schema: {
          ...contractSchema(unsubscribeFromChannel, { hide }),
          params: unsubscribeFromChannel.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.unsubscribe(user, request.params.id);
        return reply.status(200).send(result);
      }
    );
  }

  for (const { path, hide } of contractPaths(isSubscribedToChannel)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(isSubscribedToChannel, { hide }),
          params: isSubscribedToChannel.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.isSubscribed(user, request.params.id);
        return reply.status(200).send(result);
      }
    );
  }

  for (const { path, hide } of contractPaths(listMySubscriptions)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listMySubscriptions, { hide }),
          querystring: listMySubscriptions.query,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await subscriptionService.listSubscriptions(user, request.query);
        return reply.status(200).send(result);
      }
    );
  }

  for (const { path, hide } of contractPaths(getSubscriptionFeed)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getSubscriptionFeed, { hide }),
          querystring: getSubscriptionFeed.query,
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
