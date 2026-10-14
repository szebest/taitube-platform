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
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function subscriptionsRoutes(app: FastifyInstance): Promise<void> {
  const { subscriptionService } = app.services;
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
        return sendResult(
          reply,
          request,
          await subscriptionService.subscribe(user, request.params.id)
        );
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
        return sendResult(
          reply,
          request,
          await subscriptionService.unsubscribe(user, request.params.id)
        );
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
        return sendResult(
          reply,
          request,
          await subscriptionService.isSubscribed(user, request.params.id)
        );
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
        return sendResult(
          reply,
          request,
          await subscriptionService.listSubscriptions(user, request.query)
        );
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
        return sendResult(reply, request, await subscriptionService.getFeed(user, request.query));
      }
    );
  }
}
