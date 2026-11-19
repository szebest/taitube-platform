import { type ParsedLocation, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { parseSlot } from './account-slots';
import type { IdentityStore } from './identity-store';
import type { Session } from './session';

const ORIGIN_PROBE = 'http://localhost';

/** A path on this origin; `//evil.example`, `/\evil.example` and `javascript:` resolve elsewhere. */
function isSameOriginPath(target: string): boolean {
  return target.startsWith('/') && URL.parse(target, ORIGIN_PROBE)?.origin === ORIGIN_PROBE;
}

/**
 * `/login`'s search: where to go back to once signed in, dropped when it would leave this origin,
 * `reason=expired` when the session ended under the viewer, the `slot` to sign in again, and
 * `add=1` to add an account beside the ones signed in.
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
  slot: z
    .union([z.string(), z.number()])
    .optional()
    .transform((slot) => parseSlot(slot === undefined ? undefined : String(slot))),
  add: z
    .union([z.string(), z.number()])
    .optional()
    .transform((add) => String(add) === '1' || undefined),
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

type LoginContext = { context: { auth: Session; identity: Pick<IdentityStore, 'read'> } };

/**
 * `/login`'s `beforeLoad`: a signed-in viewer goes on to where the sign-in was asked for, unless
 * they came to add an account or to sign another slot in again.
 */
export function leaveLoginWhenSignedIn({
  context,
  search,
}: LoginContext & { search: z.infer<typeof LoginSearchSchema> }) {
  if (context.auth.status === 'guest' || search.add) return;
  if (search.slot !== undefined && search.slot !== context.identity.read().identity.slot) return;
  throw redirect({ href: search.redirect ?? '/' });
}
