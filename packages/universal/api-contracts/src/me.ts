import { COUNTRIES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ROLES } from '@vp/permissions';
import { z } from 'zod';
import { BannerLinkSchema } from './channel-images';
import { ChannelLinkSchema, OwnerChannelSchema } from './channels';
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
  channel: OwnerChannelSchema,
});

const UpdateChannelSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  handle: z.string().optional(),
  avatarUrl: z.url().nullable().optional(),
  bannerUrl: z.url().nullable().optional(),
  brandColor: z
    .string()
    .nullable()
    .optional()
    .describe('A #rrggbb colour, any case, stored lowercase; null clears it'),
  bio: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .describe('The default description: up to 5000 characters of plain text'),
  links: z
    .array(ChannelLinkSchema)
    .optional()
    .describe('Replaces the list: up to eight, https only; an empty list clears it'),
  country: z.enum(COUNTRIES).nullable().optional().describe('ISO 3166-1 alpha-2; null clears it'),
  contactEmail: z
    .string()
    .nullable()
    .optional()
    .describe('Shown to a signed-in visitor on request only; null clears it'),
  bannerLink: BannerLinkSchema.nullable().optional().describe('null clears it'),
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
  channelScoped: true,
  tag: 'Account',
  summary: 'Update authenticated user channel profile',
  description:
    'Updates handle, display name, avatar, banner, description, links, banner link, country or contact email of the acting channel. A handle changes at most once every 30 days (`HANDLE_CHANGE_TOO_SOON`) and cannot take one another channel gave up in the last 90 days (`HANDLE_RESERVED`); the old one keeps resolving to this channel meanwhile.',
  body: UpdateChannelSchema,
  status: 200,
  result: OwnerChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_HANDLE_FORMAT],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    409: [
      ErrorCodes.HANDLE_ALREADY_TAKEN,
      ErrorCodes.HANDLE_CHANGE_TOO_SOON,
      ErrorCodes.HANDLE_RESERVED,
    ],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const getMyChannel = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel',
  channelScoped: true,
  tag: 'Account',
  summary: 'Read the acting channel for editing',
  description:
    "The channel `X-Channel-Id` names, or the caller's own, with what only its team sees: contact email, banner crops and when the handle may change. Owner, manager and editor; a moderator gets 403.",
  status: 200,
  result: OwnerChannelSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type Account = z.infer<typeof AccountSchema>;
