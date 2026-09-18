import { z } from 'zod';

export const ChannelSubscriberParamsSchema = z.object({
  id: z.string().uuid({ message: 'Invalid channel ID format' }),
});

export const SubscribeResponseSchema = z.object({
  channelId: z.string().uuid(),
  subscribed: z.boolean(),
  subscriberCount: z.number().int().nonnegative(),
});

export const UnsubscribeResponseSchema = z.object({
  channelId: z.string().uuid(),
  subscribed: z.boolean(),
  subscriberCount: z.number().int().nonnegative(),
});

export const IsSubscribedResponseSchema = z.object({
  channelId: z.string().uuid(),
  subscribed: z.boolean(),
});

export const SubscribedChannelSchema = z.object({
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

export const ListSubscriptionsResponseSchema = z.object({
  items: z.array(SubscribedChannelSchema),
  nextCursor: z.string().nullable(),
});

export const ListSubscriptionsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque base64url keyset pagination cursor'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Page size limit (1-100, default 20)'),
});

export const SubscriptionFeedQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque base64url keyset pagination cursor'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Page size limit (1-100, default 20)'),
});
