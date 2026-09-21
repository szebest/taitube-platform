import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

export const ChannelSchema = z.object({
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

export const ChannelIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid channel ID format' }),
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
export type ChannelIdParam = z.infer<typeof ChannelIdParamSchema>;
