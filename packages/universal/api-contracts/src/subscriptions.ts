import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelIdParamSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { FeedResponseSchema } from './feed';
import { KeysetQuerySchema } from './pagination';

const SubscriptionStateSchema = z.object({
  channelId: z.string().uuid(),
  subscribed: z.boolean(),
  subscriberCount: z.number().int().nonnegative(),
});

const IsSubscribedSchema = z.object({
  channelId: z.string().uuid(),
  subscribed: z.boolean(),
});

const SubscribedChannelSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  subscriberCount: z.number().int().nonnegative(),
  subscribedAt: z.string(),
});

const ListSubscriptionsResponseSchema = z.object({
  items: z.array(SubscribedChannelSchema),
  nextCursor: z.string().nullable(),
});

export const subscribeToChannel = defineEndpoint({
  method: 'POST',
  path: '/v1/channels/:id/subscribers',
  tag: 'Subscriptions',
  summary: 'Subscribe to channel',
  description:
    'Idempotently subscribes the authenticated caller to the channel. Increments subscriber count and updates Redis cache.',
  params: ChannelIdParamSchema,
  status: 200,
  result: SubscriptionStateSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const unsubscribeFromChannel = defineEndpoint({
  method: 'DELETE',
  path: '/v1/channels/:id/subscribers',
  tag: 'Subscriptions',
  summary: 'Unsubscribe from channel',
  description:
    'Idempotently unsubscribes the authenticated caller from the channel. Decrements subscriber count and updates Redis cache.',
  params: ChannelIdParamSchema,
  status: 200,
  result: SubscriptionStateSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const isSubscribedToChannel = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:id/subscribers/me',
  tag: 'Subscriptions',
  summary: 'Check if authenticated caller is subscribed to channel',
  description:
    'Checks whether the caller subscribes to the channel. Served with sub-millisecond latency via Redis set.',
  params: ChannelIdParamSchema,
  status: 200,
  result: IsSubscribedSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const listMySubscriptions = defineEndpoint({
  method: 'GET',
  path: '/v1/me/subscriptions',
  tag: 'Subscriptions',
  summary: 'List channels current user is subscribed to',
  description:
    'Returns keyset-paginated list of channels the current authenticated user subscribes to, newest first.',
  query: KeysetQuerySchema,
  status: 200,
  result: ListSubscriptionsResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const getSubscriptionFeed = defineEndpoint({
  method: 'GET',
  path: '/v1/feed/subscriptions',
  tag: 'Subscriptions',
  summary: 'Subscribed channels video feed',
  description:
    'Keyset-paginated list of READY and public videos published by channels the user subscribes to, sorted newest first.',
  query: KeysetQuerySchema,
  status: 200,
  result: FeedResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export type SubscriptionState = z.infer<typeof SubscriptionStateSchema>;
export type IsSubscribed = z.infer<typeof IsSubscribedSchema>;
export type SubscribedChannel = z.infer<typeof SubscribedChannelSchema>;
export type ListSubscriptionsResponse = z.infer<typeof ListSubscriptionsResponseSchema>;
