import { type ParsedLocation, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import type { Session } from './session';

const ORIGIN_PROBE = 'http://localhost';

/** A path on this origin; `//evil.example`, `/\evil.example` and `javascript:` resolve elsewhere. */
function isSameOriginPath(target: string): boolean {
  return target.startsWith('/') && URL.parse(target, ORIGIN_PROBE)?.origin === ORIGIN_PROBE;
}

/**
 * `/login`'s search: where to go back to once signed in, dropped when it would leave this origin,
 * and `reason=expired` when the session ended under the viewer.
 */
export const LoginSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .transform((target) => (target && isSameOriginPath(target) ? target : undefined)),
  reason: z
    .string()
    .optional()
    .transform((reason) => (reason === 'expired' ? reason : undefined)),
});

type SessionContext = { context: { auth: Session } };

/** `_authed`'s `beforeLoad`: a guest goes to `/login`, and back here once signed in. */
export function requireSignedIn({
  context,
  location,
}: SessionContext & { location: Pick<ParsedLocation, 'href'> }) {
  if (context.auth.status === 'signed-in') return;
  throw redirect({ to: '/login', search: { redirect: location.href } });
}

/** `/login`'s `beforeLoad`: a signed-in viewer goes on to where the sign-in was asked for. */
export function leaveLoginWhenSignedIn({
  context,
  search,
}: SessionContext & { search: z.infer<typeof LoginSearchSchema> }) {
  if (context.auth.status === 'guest') return;
  throw redirect({ href: search.redirect ?? '/' });
}
