import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelRoleSchema } from './channel-audit';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';

const TAG = 'Account';

const OwnedChannelSchema = ChannelCardSchema.extend({
  isPrimary: z.boolean().describe('The one channel an account acts as by default'),
});

const MemberChannelSchema = ChannelCardSchema.extend({
  role: ChannelRoleSchema,
  ownerId: z.uuid().describe("The channel owner's user id"),
});

const IdentitiesSchema = z.object({
  account: z.object({ id: z.uuid(), email: z.email() }),
  owned: z.array(OwnedChannelSchema).describe('The primary first, then oldest first'),
  member: z.array(MemberChannelSchema).describe('The channels whose team the caller is on'),
});

const CreateChannelSchema = z.object({
  handle: z.string().describe('3 to 30 of a-z, 0-9, `_`, `.`, `-`; stored lowercase'),
  displayName: z.string().trim().min(1).max(100),
});

const ChannelParamSchema = z.object({ id: z.uuid({ error: 'Invalid channel ID format' }) });

const PromoteChannelSchema = z.object({
  isPrimary: z.literal(true).describe('Only promotion: the old primary steps down'),
});

export const createMyChannel = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channels',
  tag: TAG,
  summary: 'Create another channel the caller owns',
  description:
    "Up to `CHANNELS_MAX_OWNED` owned channels (`CHANNEL_LIMIT_REACHED`); the handle follows the same rules as a handle change. The new channel is not primary unless it is the caller's first.",
  body: CreateChannelSchema,
  status: 201,
  result: OwnedChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_HANDLE_FORMAT],
    401: [ErrorCodes.UNAUTHORIZED],
    409: [
      ErrorCodes.CHANNEL_LIMIT_REACHED,
      ErrorCodes.HANDLE_ALREADY_TAKEN,
      ErrorCodes.HANDLE_RESERVED,
    ],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const promoteMyChannel = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/channels/:id',
  tag: TAG,
  summary: 'Make an owned channel the primary one',
  description:
    'Owner only: a member of the channel gets `CHANNEL_NOT_OWNED`. `GET /v1/me/account` returns the primary as `channel`.',
  params: ChannelParamSchema,
  body: PromoteChannelSchema,
  status: 200,
  result: OwnedChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.CHANNEL_NOT_OWNED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const listMyIdentities = defineEndpoint({
  method: 'GET',
  path: '/v1/me/identities',
  tag: TAG,
  summary: 'List every identity the caller can act as',
  description:
    'The account, the channels it owns and the channels whose team it is on, with the role there: each may be named in `X-Channel-Id`.',
  status: 200,
  result: IdentitiesSchema,
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});

export type OwnedChannelView = z.infer<typeof OwnedChannelSchema>;
export type IdentitiesView = z.infer<typeof IdentitiesSchema>;
export type CreateChannelBody = z.infer<typeof CreateChannelSchema>;
