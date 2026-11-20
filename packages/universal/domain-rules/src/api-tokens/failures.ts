import { type Failure } from '@kit/errors';
import { API_TOKEN_LIMITS, type ApiScope } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';

export type ApiTokenNotFound = Failure<typeof ErrorCodes.API_TOKEN_NOT_FOUND, { tokenId: string }>;

export type ApiTokenLimitReached = Failure<
  typeof ErrorCodes.API_TOKEN_LIMIT_REACHED,
  { limit: number }
>;

export type ApiTokenScopeMissing = Failure<
  typeof ErrorCodes.API_TOKEN_SCOPE_MISSING,
  { scope: ApiScope | null }
>;

export type ApiTokenWithSession = Failure<typeof ErrorCodes.API_TOKEN_WITH_SESSION>;

export type ApiTokenRateLimited = Failure<
  typeof ErrorCodes.RATE_LIMITED,
  { retryAfterSeconds: number }
>;

/** Shaped like every other refused credential, so the caller sees one 401 whatever was wrong. */
export type ApiTokenRefused = Failure<typeof ErrorCodes.UNAUTHORIZED, { reason: string }>;

export function apiTokenNotFound(tokenId: string): ApiTokenNotFound {
  return { code: ErrorCodes.API_TOKEN_NOT_FOUND, message: 'Token not found', tokenId };
}

export function apiTokenLimitReached(): ApiTokenLimitReached {
  const limit = API_TOKEN_LIMITS.activePerUser;
  return {
    code: ErrorCodes.API_TOKEN_LIMIT_REACHED,
    message: `At most ${limit} tokens can be active`,
    limit,
  };
}

/** `scope` is `null` on a route no token may call. */
export function apiTokenScopeMissing(scope: ApiScope | null): ApiTokenScopeMissing {
  return {
    code: ErrorCodes.API_TOKEN_SCOPE_MISSING,
    message:
      scope === null
        ? 'A personal access token cannot call this route'
        : `This route needs a token with the ${scope} scope`,
    scope,
  };
}

export function apiTokenWithSession(): ApiTokenWithSession {
  return {
    code: ErrorCodes.API_TOKEN_WITH_SESSION,
    message: 'A request carries a personal access token or a session cookie, never both',
  };
}

export function apiTokenRefused(reason: string): ApiTokenRefused {
  return { code: ErrorCodes.UNAUTHORIZED, message: 'Invalid personal access token', reason };
}

export function apiTokenRateLimited(retryAfterSeconds: number): ApiTokenRateLimited {
  return {
    code: ErrorCodes.RATE_LIMITED,
    message: `At most ${API_TOKEN_LIMITS.requestsPerMinute} requests a minute per token`,
    retryAfterSeconds,
  };
}
