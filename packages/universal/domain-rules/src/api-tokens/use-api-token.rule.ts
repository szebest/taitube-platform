import { type Result, err, ok } from '@kit/result';
import { type ApiToken, apiTokenStatus } from '@vp/domain';
import { API_TOKEN } from './api-token.machine';
import { type ApiTokenRefused, apiTokenRefused } from './failures';

export interface UseApiTokenInput {
  /** The row whose hash matched the presented secret; `null` when none did. */
  readonly found: ApiToken | null;
  readonly now: Date;
}

export function decideApiTokenUse({
  found,
  now,
}: UseApiTokenInput): Result<ApiToken, ApiTokenRefused> {
  if (!found) return err(apiTokenRefused('unknown token'));
  const status = apiTokenStatus(found, now);
  if (!API_TOKEN.next(status, 'use')) return err(apiTokenRefused(`token ${status}`));
  return ok(found);
}
