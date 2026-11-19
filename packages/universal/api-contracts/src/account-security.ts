import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const SignInSchema = z.object({
  id: z.uuid(),
  action: z.string().describe('`account.signed_in`'),
  slot: z.number().int().min(0).max(9).nullable().describe('The browser slot signed into'),
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

export type SignInPageView = z.infer<typeof SignInPageSchema>;
