import {
  API_SCOPES,
  API_TOKEN_EXPIRIES,
  API_TOKEN_LIMITS,
  API_TOKEN_STATUSES,
  DEFAULT_API_TOKEN_EXPIRY,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const ApiTokenIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid token ID format' }) });

const ApiScopeSchema = z.enum(API_SCOPES);

const EXPIRIES = Object.keys(API_TOKEN_EXPIRIES) as [keyof typeof API_TOKEN_EXPIRIES];

const ApiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string().describe('The 8 characters after `tt_pat_`, to tell tokens apart'),
  channelId: z.uuid().describe('The channel the token acts on'),
  scopes: z.array(ApiScopeSchema),
  expiresAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  requestsToday: z
    .number()
    .int()
    .nonnegative()
    .describe('Requests made with it since midnight UTC'),
  status: z.enum(API_TOKEN_STATUSES),
  createdAt: z.iso.datetime(),
});

const CreatedApiTokenSchema = ApiTokenSchema.extend({
  token: z
    .string()
    .describe('`tt_pat_{prefix}_{secret}`. Shown here once and never returned again'),
});

const ApiTokenListSchema = z.object({ items: z.array(ApiTokenSchema) });

const CreateApiTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(API_TOKEN_LIMITS.nameMaxLength),
  scopes: z.array(ApiScopeSchema).min(1).max(API_SCOPES.length),
  expiry: z
    .enum(EXPIRIES)
    .default(DEFAULT_API_TOKEN_EXPIRY)
    .describe('30 days, 90 days or a year; never unlimited'),
});

const TAG = 'Personal access tokens';
const SESSION_ONLY = 'A session only: a request made with a token is refused.';

export const createApiToken = defineEndpoint({
  method: 'POST',
  path: '/v1/me/api-tokens',
  channelScoped: true,
  tag: TAG,
  summary: 'Create a personal access token',
  description: `A token for scripts, acting as the caller on the acting channel and never doing more than the caller may there. Send it as \`Authorization: Bearer tt_pat_...\` on a route that names one of its scopes; a request with both a token and a session cookie is refused. ${API_TOKEN_LIMITS.requestsPerMinute} requests a minute per token, at most ${API_TOKEN_LIMITS.activePerUser} active per user. ${SESSION_ONLY}`,
  body: CreateApiTokenBodySchema,
  status: 201,
  result: CreatedApiTokenSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    409: [ErrorCodes.API_TOKEN_LIMIT_REACHED],
  },
});

export const listApiTokens = defineEndpoint({
  method: 'GET',
  path: '/v1/me/api-tokens',
  tag: TAG,
  summary: 'List my personal access tokens',
  description: `Active and expired tokens of every channel, newest first; revoked ones are gone. Secrets are never returned. ${SESSION_ONLY}`,
  status: 200,
  result: ApiTokenListSchema,
  errors: { 401: [ErrorCodes.UNAUTHORIZED], 403: [ErrorCodes.FORBIDDEN] },
});

export const revokeApiToken = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/api-tokens/:id',
  tag: TAG,
  summary: 'Revoke a personal access token',
  description: `The next request made with it is a 401. Answers 404 for a token the caller does not hold or already revoked. ${SESSION_ONLY}`,
  params: ApiTokenIdParamSchema,
  status: 204,
  result: z.null().describe('Token revoked'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.API_TOKEN_NOT_FOUND],
  },
});

export type ApiTokenView = z.infer<typeof ApiTokenSchema>;
export type CreatedApiTokenView = z.infer<typeof CreatedApiTokenSchema>;
export type ApiTokenListView = z.infer<typeof ApiTokenListSchema>;
export type CreateApiTokenBody = z.infer<typeof CreateApiTokenBodySchema>;
