import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ProfileSchema } from './channel-audit';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const TAG = 'Comment moderation';

const UserParamSchema = z.object({ userId: z.uuid({ error: 'Invalid user ID format' }) });

const TrustedCommenterSchema = z.object({
  userId: z.uuid(),
  createdBy: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  user: ProfileSchema.nullable(),
});

export type TrustedCommenterView = z.infer<typeof TrustedCommenterSchema>;

const TrustedCommenterPageSchema = z.object({
  items: z.array(TrustedCommenterSchema),
  nextCursor: z.string().nullable(),
});

const ERRORS = { 401: [ErrorCodes.UNAUTHORIZED], 403: [ErrorCodes.FORBIDDEN] } as const;

export const listTrustedCommenters = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/trusted-commenters',
  channelScoped: true,
  tag: TAG,
  summary: 'List the trusted commenters of the channel',
  description:
    'Users whose comments skip every automatic hold, slow mode and the account age check, newest first. Owner and managers.',
  query: KeysetQuerySchema,
  status: 200,
  result: TrustedCommenterPageSchema,
  errors: { ...ERRORS, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const trustCommenter = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/trusted-commenters/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Trust a commenter',
  description:
    'Idempotent: trusting a trusted user changes and logs nothing. Records trusted.added in the channel audit log. Owner and managers.',
  params: UserParamSchema,
  status: 204,
  result: z.null().describe('The user is trusted'),
  errors: { ...ERRORS, 400: [ErrorCodes.VALIDATION_FAILED], 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const untrustCommenter = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/trusted-commenters/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Stop trusting a commenter',
  description:
    'Idempotent: removing a user who is not trusted changes and logs nothing. Records trusted.removed. Owner and managers.',
  params: UserParamSchema,
  status: 204,
  result: z.null().describe('The user is no longer trusted'),
  errors: { ...ERRORS, 400: [ErrorCodes.VALIDATION_FAILED] },
});
