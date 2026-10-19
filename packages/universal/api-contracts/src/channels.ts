import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

export const ChannelLinkSchema = z
  .object({
    label: z.string().describe('1-40 characters of plain text after trimming'),
    url: z.string().describe('An https URL of up to 2048 characters'),
  })
  .meta({ id: 'ChannelLink', description: 'A link the creator lists on the channel About tab' });

export const ChannelSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  links: z.array(ChannelLinkSchema).describe('Up to five, in the order the creator set'),
  subscriberCount: z.number().int(),
  videoCount: z
    .number()
    .int()
    .nonnegative()
    .describe('Public, ready videos; kept as a counter, not counted per request'),
  totalViews: z
    .number()
    .int()
    .nonnegative()
    .describe('Views of those videos; kept as a counter, not counted per request'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ChannelCardSchema = z
  .object({
    id: z.uuid(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .meta({
    id: 'ChannelCard',
    description: 'The channel that owns the resource, null for a user without one',
  });

export const ChannelIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid channel ID format' }),
});

export const ChannelHandleParamSchema = z.object({
  idOrHandle: z.string().min(1),
});

export const getChannel = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle',
  tag: 'Channels',
  summary: 'Get public creator channel profile',
  description:
    'Returns public channel details, subscriber count, avatar, banner, and bio by channel UUID or @handle.',
  anonymous: true,
  params: ChannelHandleParamSchema,
  status: 200,
  result: ChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type Channel = z.infer<typeof ChannelSchema>;
