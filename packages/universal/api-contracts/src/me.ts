import { ErrorCodes } from '@vp/errors';
import { ROLES } from '@vp/permissions';
import { z } from 'zod';
import { ChannelLinkSchema, ChannelSchema } from './channels';
import { defineEndpoint } from './endpoint';

const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  tier: z.string(),
  createdAt: z.string(),
});

const AccountSchema = UserSchema.extend({
  role: z.enum(ROLES),
  user: UserSchema,
  channel: ChannelSchema,
});

const UpdateChannelSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  handle: z.string().optional(),
  avatarUrl: z.url().nullable().optional(),
  bannerUrl: z.url().nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  links: z
    .array(ChannelLinkSchema)
    .optional()
    .describe('Replaces the list: up to five, https only; an empty list clears it'),
});

export const getAccount = defineEndpoint({
  method: 'GET',
  path: '/v1/me/account',
  tag: 'Account',
  summary: 'Get authenticated user account and channel profile',
  description: 'Returns authenticated user details and associated creator channel.',
  status: 200,
  result: AccountSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const updateMyChannel = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/channel',
  tag: 'Account',
  summary: 'Update authenticated user channel profile',
  description:
    'Updates handle, display name, avatar, banner, bio, or links for the authenticated user channel.',
  body: UpdateChannelSchema,
  status: 200,
  result: ChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_HANDLE_FORMAT],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    409: [ErrorCodes.HANDLE_ALREADY_TAKEN],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type Account = z.infer<typeof AccountSchema>;
