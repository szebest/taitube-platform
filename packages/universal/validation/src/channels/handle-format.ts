import { type Result, err, ok } from '@vp/result';
import { type InvalidHandleFormat, invalidHandleFormat } from './failures.js';

const HANDLE_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/** How many suffixed handles a caller may try before giving up on a collision run. */
export const HANDLE_CANDIDATE_ATTEMPTS = 1000;

const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'system',
  'studio',
  'feed',
  'root',
  'me',
  'user',
  'users',
  'channel',
  'channels',
  'video',
  'videos',
  'upload',
  'uploads',
  'settings',
  'dashboard',
  'explore',
  'subscriptions',
  'trending',
  'help',
  'terms',
  'privacy',
  'status',
  'login',
  'logout',
  'auth',
  'v1',
  'v2',
  'metrics',
  'healthz',
  'readyz',
  'docs',
  'swagger',
]);

const BOUNDS = { minLength: HANDLE_MIN_LENGTH, maxLength: HANDLE_MAX_LENGTH };

export function isValidHandleFormat(handle: string): boolean {
  return HANDLE_REGEX.test(handle);
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}

export function normalizeHandle(handle: string): string {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  return clean.toLowerCase().trim();
}

/**
 * Format only, which is all an input rule can see. Whether a well-formed handle is *available* -
 * reserved, or already held by another channel - needs the reserved list and a repository read, so
 * it is `decideHandleClaim` in `@vp/domain-rules`.
 */
export function validateHandle(handle: string): Result<string, InvalidHandleFormat> {
  return isValidHandleFormat(handle)
    ? ok(normalizeHandle(handle))
    : err(invalidHandleFormat(handle, BOUNDS));
}

function handleBase(email: string, sub: string): string {
  const raw = email.split('@')[0] || sub.slice(0, 8);
  let base = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

  if (base.length < HANDLE_MIN_LENGTH) {
    base = `user_${base}`;
  }
  if (isReservedHandle(base)) {
    base = `u_${base}`;
  }

  return base.slice(0, HANDLE_MAX_LENGTH);
}

function handleDiscriminator(sub: string): string {
  return (
    sub
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toLowerCase() || '01'
  );
}

/**
 * Handles a new channel may claim, most desirable first: the identity's own name, then the same
 * name disambiguated by part of the subject, then numbered variants. Every candidate already
 * satisfies `isValidHandleFormat` and is not reserved, so a caller only has to test availability.
 */
export function* handleCandidates(email: string, sub: string): Generator<string> {
  const base = handleBase(email, sub);
  const discriminator = handleDiscriminator(sub);

  const suffixed = (suffix: string): string => {
    const room = HANDLE_MAX_LENGTH - discriminator.length - suffix.length - 1;
    return `${base.slice(0, room)}_${discriminator}${suffix}`;
  };

  const claimable = (candidate: string): boolean =>
    isValidHandleFormat(candidate) && !isReservedHandle(candidate);

  if (claimable(base)) {
    yield base;
  }
  if (claimable(suffixed(''))) {
    yield suffixed('');
  }
  for (let attempt = 1; attempt <= HANDLE_CANDIDATE_ATTEMPTS; attempt++) {
    const candidate = suffixed(String(attempt));
    if (claimable(candidate)) {
      yield candidate;
    }
  }
}
