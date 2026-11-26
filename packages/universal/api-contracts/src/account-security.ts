import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

/** The ten places one browser keeps a signed-in account in (`ACCOUNTS_MAX` caps how many are used). */
export const AccountSlotSchema = z.number().int().min(0).max(9);

/** How many adds one client address may make in `ADD_ACCOUNT_WINDOW`. */
export const ADD_ACCOUNT_LIMIT = 5;

export const ADD_ACCOUNT_WINDOW = '10 minutes';

const SignInSchema = z.object({
  id: z.uuid(),
  action: z.string().describe('`account.signed_in`'),
  slot: AccountSlotSchema.nullable().describe('The browser slot signed into'),
  userAgent: z.string().nullable().describe('Truncated; no address is stored'),
  createdAt: z.iso.datetime(),
});

const SignInPageSchema = z.object({
  items: z.array(SignInSchema),
  nextCursor: z.string().nullable(),
});

export const listMySignIns = defineEndpoint({
  method: 'GET',
  path: '/v1/me/security/sign-ins',
  tag: 'Account',
  summary: "Read the caller's sign-in history",
  description: 'Newest first, keyset-paginated; the caller sees only their own rows.',
  query: KeysetQuerySchema,
  status: 200,
  result: SignInPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const recordMySignIn = defineEndpoint({
  method: 'POST',
  path: '/v1/me/security/sign-ins',
  tag: 'Account',
  summary: 'Record a sign-in into a browser slot',
  description:
    "Called by a client app's server once it holds a new token for the slot, with that token: appends `account.signed_in` to the caller's own log. An added account (`added: true`) is rate-limited per client address, 5 in 10 minutes.",
  body: z.strictObject({
    slot: AccountSlotSchema,
    added: z.boolean().describe('A second or later account signing in beside the others'),
  }),
  status: 201,
  result: SignInSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type SignInView = z.infer<typeof SignInSchema>;

export type SignInPageView = z.infer<typeof SignInPageSchema>;
