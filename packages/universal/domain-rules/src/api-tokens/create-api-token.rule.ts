import { type Result, andThen, err, ok } from '@kit/result';
import {
  API_TOKEN_LIMITS,
  type ApiScope,
  type ApiToken,
  type ApiTokenExpiry,
  apiTokenExpiry,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import type { AuthorizationFailure } from '../authorize';
import { type ApiTokenLimitReached, apiTokenLimitReached } from './failures';
import { decideApiTokenAccess } from './token-access.rule';

export interface CreateApiTokenInput {
  readonly user: UserContext | null;
  /** How many unrevoked, unexpired tokens the caller holds now. */
  readonly active: number;
  readonly id: string;
  /** The acting channel: the token acts there and nowhere else. */
  readonly channelId: string;
  readonly name: string;
  readonly scopes: readonly ApiScope[];
  readonly expiry: ApiTokenExpiry;
  readonly prefix: string;
  readonly secretHash: string;
  readonly now: Date;
}

export type CreateApiTokenFailure = AuthorizationFailure | ApiTokenLimitReached;

export function decideApiTokenCreate(
  input: CreateApiTokenInput
): Result<ApiToken, CreateApiTokenFailure> {
  const { user, active, id, channelId, name, scopes, expiry, prefix, secretHash, now } = input;

  return andThen(
    decideApiTokenAccess({ user, access: 'create' }),
    (owner): Result<ApiToken, CreateApiTokenFailure> => {
      if (active >= API_TOKEN_LIMITS.activePerUser) return err(apiTokenLimitReached());
      return ok({
        id,
        userId: owner.id,
        channelId,
        name: name.trim(),
        prefix,
        secretHash,
        scopes: [...new Set(scopes)],
        expiresAt: apiTokenExpiry(expiry, now),
        lastUsedAt: null,
        revokedAt: null,
        createdAt: now,
      });
    }
  );
}
