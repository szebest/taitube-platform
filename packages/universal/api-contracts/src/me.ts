import { ErrorCodes } from '@vp/errors';
import { ROLES } from '@vp/permissions';
import { CHANNEL_IMAGE_KINDS } from '@vp/validation';
import { z } from 'zod';
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
  avatarKey: z
    .string()
    .optional()
    .describe('An uploaded avatar, as `issueChannelImageUpload` returned it; replaces avatarUrl'),
  bannerKey: z
    .string()
    .optional()
    .describe('An uploaded banner, as `issueChannelImageUpload` returned it; replaces bannerUrl'),
  brandColor: z
    .string()
    .nullable()
    .optional()
    .describe('A #rrggbb colour, any case, stored lowercase; null clears it'),
  bio: z.string().max(1000).nullable().optional(),
  links: z
    .array(ChannelLinkSchema)
    .optional()
    .describe('Replaces the list: up to five, https only; an empty list clears it'),
});

const ChannelImageUploadRequestSchema = z.object({
  kind: z.enum(CHANNEL_IMAGE_KINDS),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const ChannelImageUploadSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
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
    'Updates handle, display name, avatar, banner, bio, or links for the authenticated user channel.',
  body: UpdateChannelSchema,
  status: 200,
  result: OwnerChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_HANDLE_FORMAT],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    409: [ErrorCodes.HANDLE_ALREADY_TAKEN],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const issueChannelImageUpload = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/images',
  channelScoped: true,
  tag: 'Account',
  summary: 'Presign an avatar or banner upload',
  description:
    'Returns a presigned PUT to the public bucket for an image of the authenticated user channel (jpeg, png or webp; 5 MB for an avatar, 10 MB for a banner). Send the key back in `PATCH /v1/me/channel` once the upload is done.',
  body: ChannelImageUploadRequestSchema,
  status: 201,
  result: ChannelImageUploadSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    422: [ErrorCodes.UPLOAD_TOO_LARGE, ErrorCodes.UNSUPPORTED_CONTENT_TYPE],
  },
});

export type Account = z.infer<typeof AccountSchema>;
