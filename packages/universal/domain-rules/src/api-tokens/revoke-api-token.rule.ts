import { type Result, err, ok } from '@kit/result';
import { type ApiToken, apiTokenStatus } from '@vp/domain';
import { API_TOKEN } from './api-token.machine';
import { type ApiTokenNotFound, apiTokenNotFound } from './failures';

export interface RevokeApiTokenInput {
  readonly tokenId: string;
  /** Looked up among the caller's own tokens, so another user's is never found. */
  readonly found: ApiToken | null;
  readonly now: Date;
}

/** A revoked token is gone from the caller's view, so revoking it again is not found. */
export function decideApiTokenRevoke({
  tokenId,
  found,
  now,
}: RevokeApiTokenInput): Result<ApiToken, ApiTokenNotFound> {
  if (!found || !API_TOKEN.next(apiTokenStatus(found, now), 'revoke')) {
    return err(apiTokenNotFound(tokenId));
  }
  return ok(found);
}
