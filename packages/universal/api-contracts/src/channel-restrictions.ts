import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ProfileSchema } from './channel-audit';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const TAG = 'Comment moderation';

const UserParamSchema = z.object({ userId: z.uuid({ error: 'Invalid user ID format' }) });

const ChannelParamSchema = z.object({ id: z.uuid({ error: 'Invalid channel ID format' }) });

export const RestrictionActionSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('shadow_ban') }),
    z.object({
      action: z.literal('ban'),
      reason: z
        .string()
        .max(200)
        .optional()
        .describe('Shown to the banned user; up to 200 characters'),
      expiresAt: z.iso
        .datetime()
        .nullable()
        .optional()
        .describe('When the ban ends; absent or null for a permanent one'),
    }),
  ])
  .describe(
    'A shadow ban is silent and never ends; a ban is told to the user, refuses their writes and may end'
  );

export type RestrictionActionBody = z.infer<typeof RestrictionActionSchema>;

const RestrictionSchema = z.object({
  userId: z.uuid(),
  kind: z.enum(['shadow', 'ban']),
  reason: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdBy: z.uuid().nullable().describe('null once the moderator deleted their account'),
  createdAt: z.iso.datetime(),
  user: ProfileSchema.nullable().describe('The restricted user own channel, when they have one'),
});

export type RestrictionView = z.infer<typeof RestrictionSchema>;

const RestrictionPageSchema = z.object({
  items: z.array(RestrictionSchema),
  nextCursor: z.string().nullable(),
});

const OwnRestrictionSchema = z.object({
  reason: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});

export type OwnRestrictionView = z.infer<typeof OwnRestrictionSchema>;

const SIGNED_IN = { 401: [ErrorCodes.UNAUTHORIZED] } as const;
const RESTRICTING = { ...SIGNED_IN, 403: [ErrorCodes.FORBIDDEN] } as const;

export const listRestrictions = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/restrictions',
  channelScoped: true,
  tag: TAG,
  summary: 'List the restricted users of the channel',
  description:
    'Shadow bans and bans that have not ended, newest first, keyset-paginated. The owner, managers and moderators. An ended ban is absent whether or not housekeeping has purged it.',
  query: KeysetQuerySchema,
  status: 200,
  result: RestrictionPageSchema,
  errors: { ...RESTRICTING, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const restrictUser = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/restrictions/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Shadow ban or ban a user on the channel',
  description:
    'Replaces what the user had on the channel. A shadow ban takes their comments out of every public read, count and notification; a ban refuses their comments and reactions with COMMENTS_BANNED and tells them. Counts are recounted exactly in the same transaction. The owner and the team cannot be restricted. Records user.shadow_banned or user.banned in the audit log.',
  params: UserParamSchema,
  body: RestrictionActionSchema,
  status: 200,
  result: RestrictionSchema,
  errors: {
    ...RESTRICTING,
    400: [ErrorCodes.VALIDATION_FAILED],
    409: [ErrorCodes.CANNOT_RESTRICT_MEMBER],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const liftRestriction = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/restrictions/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Lift the restriction on a user',
  description:
    'Lifts a shadow ban or a ban. Nothing is rewritten: what the shadow ban hid is public again once the counts are recounted. Records user.restriction_lifted in the audit log.',
  params: UserParamSchema,
  status: 204,
  result: z.null().describe('Restriction lifted'),
  errors: {
    ...RESTRICTING,
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.RESTRICTION_NOT_FOUND],
  },
});

export const getOwnRestriction = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:id/me/restriction',
  tag: TAG,
  summary: 'The own visible ban on a channel',
  description:
    'The caller own ban on the channel with its reason and end, for the composer. 404 for no ban, for an ended one, and for a shadow ban, which is never told.',
  params: ChannelParamSchema,
  status: 200,
  result: OwnRestrictionSchema,
  errors: {
    ...SIGNED_IN,
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.RESTRICTION_NOT_FOUND],
  },
});
