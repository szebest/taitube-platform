import { type Result, err, isErr, map, ok } from '@kit/result';
import type {
  ApiTokenListView,
  ApiTokenView,
  CreateApiTokenBody,
  CreatedApiTokenView,
} from '@vp/api-contracts';
import type { ApiTokenRepositoryPort } from '@vp/core/repositories';
import {
  type ActingChannel,
  type ApiTokenParts,
  type ApiTokenSummary,
  apiTokenStatus,
  formatApiToken,
  parseApiToken,
} from '@vp/domain';
import {
  type ApiTokenNotFound,
  type ApiTokenRefused,
  type AuthorizationFailure,
  type CreateApiTokenFailure,
  apiTokenNotFound,
  apiTokenRefused,
  decideApiTokenAccess,
  decideApiTokenCreate,
  decideApiTokenRevoke,
  decideApiTokenUse,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';

/** Where the randomness and the hashing come from; the composition root hands in `node:crypto`. */
export interface ApiTokenSecrets {
  /** A fresh 8 hex character prefix and 32 random bytes in hex. */
  mint(): ApiTokenParts;
  hash(secret: string): string;
  /** Compares in constant time. */
  matches(secret: string, secretHash: string): boolean;
}

export interface ApiTokenServiceDeps {
  tokens: ApiTokenRepositoryPort;
  secrets: ApiTokenSecrets;
  now: () => number;
}

function toView({ userId: _user, ...token }: ApiTokenSummary, now: Date): ApiTokenView {
  return {
    ...token,
    status: apiTokenStatus(token, now),
    expiresAt: token.expiresAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
  };
}

/** Personal access tokens: managed with a session, used as a bearer, never stored in the clear. */
export class ApiTokenService {
  constructor(private readonly deps: ApiTokenServiceDeps) {}

  async create(
    user: UserContext,
    acting: ActingChannel,
    { name, scopes, expiry }: CreateApiTokenBody
  ): Promise<Result<CreatedApiTokenView, CreateApiTokenFailure | DatabaseUnavailable>> {
    const { tokens, secrets } = this.deps;
    const allowed = decideApiTokenAccess({ user, access: 'create' });
    if (isErr(allowed)) return allowed;
    const now = new Date(this.deps.now());
    const active = await tokens.countActive(user.id, now);
    if (isErr(active)) return active;

    const parts = secrets.mint();
    const decided = decideApiTokenCreate({
      user,
      active: active.value,
      id: uuidv7(),
      channelId: acting.channelId,
      name,
      scopes,
      expiry,
      prefix: parts.prefix,
      secretHash: secrets.hash(parts.secret),
      now,
    });
    if (isErr(decided)) return decided;

    const { secretHash: _hash, ...token } = decided.value;
    return map(await tokens.create(decided.value), () => ({
      ...toView({ ...token, requestsToday: 0 }, now),
      token: formatApiToken(parts),
    }));
  }

  async list(
    user: UserContext
  ): Promise<Result<ApiTokenListView, AuthorizationFailure | DatabaseUnavailable>> {
    const allowed = decideApiTokenAccess({ user, access: 'read' });
    if (isErr(allowed)) return allowed;
    const now = new Date(this.deps.now());
    return map(await this.deps.tokens.listByUser(user.id, now), (rows) => ({
      items: rows.map((row) => toView(row, now)),
    }));
  }

  async revoke(
    user: UserContext,
    tokenId: string
  ): Promise<Result<void, AuthorizationFailure | ApiTokenNotFound | DatabaseUnavailable>> {
    const { tokens } = this.deps;
    const allowed = decideApiTokenAccess({ user, access: 'delete' });
    if (isErr(allowed)) return allowed;
    const found = await tokens.findOwned(user.id, tokenId);
    if (isErr(found)) return found;
    const now = new Date(this.deps.now());
    const decided = decideApiTokenRevoke({ tokenId, found: found.value, now });
    if (isErr(decided)) return decided;

    const revoked = await tokens.revoke(user.id, tokenId, now);
    if (isErr(revoked)) return revoked;
    return revoked.value ? ok() : err(apiTokenNotFound(tokenId));
  }

  /**
   * The user a bearer credential acts as, with the token's grant on it. Every row with the prefix
   * is compared, in constant time, so a prefix shared by two tokens still finds the right one.
   */
  async authenticate(
    credential: string
  ): Promise<Result<UserContext, ApiTokenRefused | DatabaseUnavailable>> {
    const { tokens, secrets } = this.deps;
    const parts = parseApiToken(credential);
    if (!parts) return err(apiTokenRefused('malformed token'));
    const candidates = await tokens.findByPrefix(parts.prefix);
    if (isErr(candidates)) return candidates;

    const match = candidates.value.find(({ token }) =>
      secrets.matches(parts.secret, token.secretHash)
    );
    const used = decideApiTokenUse({ found: match?.token ?? null, now: new Date(this.deps.now()) });
    if (isErr(used)) return used;

    const { id, userId, channelId, scopes } = used.value;
    return ok({
      id: userId,
      role: parseRole(match?.userRole),
      token: { id, channelId, scopes },
    });
  }

  recordUse(tokenId: string): Promise<Result<void, DatabaseUnavailable>> {
    return this.deps.tokens.recordUse(tokenId, new Date(this.deps.now()));
  }
}
