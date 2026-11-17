import * as crypto from 'node:crypto';
import { type Result, andThen, assertNever, err, ignore, isErr, ok } from '@kit/result';
import {
  CHANNEL_HEADER,
  contracts,
  endpointKey,
  isEndpoint,
  PARTY_CREDENTIAL_HEADER,
} from '@vp/api-contracts';
import type {
  AuthFailure,
  PartyGuestSession,
  PartyGuestSessionsPort,
  TokenVerifier,
} from '@vp/core/ports';
import { type ActingChannel, isApiTokenCredential } from '@vp/domain';
import {
  type ApiTokenRateLimited,
  type ApiTokenRefused,
  type ApiTokenScopeMissing,
  type ApiTokenWithSession,
  type ChannelMembershipRequired,
  apiTokenRateLimited,
  apiTokenScopeMissing,
  apiTokenWithSession,
} from '@vp/domain-rules';
import type { AppConfig, AuthConfig } from '@vp/env-schema';
import {
  type AnyFailure,
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  PermanentError,
  type WatchPartyCredentialInvalid,
  watchPartyCredentialInvalid,
} from '@vp/errors';
import { type TokenGrant, type UserContext, canCallWithToken, parseRole } from '@vp/permissions';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import { type SendResultOptions, sendResult } from '../routes/send-result';
import type { ApiTokenService } from '../services/api-token-service';
import type { RequestIdentity } from '../services/request-identity';
import { carriesSession, routeScopes, tokenIdentity } from './api-token-auth';
import { bearerOf } from './bearer';
import type { TokenRateLimit } from './token-rate-limit';

export interface AuthPluginOptions {
  identity: RequestIdentity;
  verifier: TokenVerifier;
  auth: AuthConfig;
  guestSessions: PartyGuestSessionsPort;
  /** Every resolve slides a party credential's life forward this far. */
  partyCredentialTtlSeconds: number;
  tokens: Pick<ApiTokenService, 'authenticate' | 'recordUse'>;
  tokenRateLimit: TokenRateLimit;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null;
    /** A guest's or a Discord member's party credential, resolved only on `partyGuest` routes. */
    party: PartyGuestSession | null;
    actingChannel: Result<ActingChannel, ChannelMembershipRequired> | null;
  }
  interface FastifyInstance {
    services: ServiceSet;
    config: AppConfig;
  }
}

function matchesAdminToken(header: unknown, adminToken: string | undefined): boolean {
  if (typeof header !== 'string' || !adminToken) return false;

  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(header).digest(),
    crypto.createHash('sha256').update(adminToken).digest()
  );
}

/** Only dev mode has a static admin credential; production admins carry a verified role claim. */
function adminFromHeader(request: FastifyRequest, auth: AuthConfig): UserContext | null {
  switch (auth.type) {
    case 'dev':
      return matchesAdminToken(request.headers['x-admin-token'], auth.adminToken)
        ? { id: auth.adminUserId, role: 'ADMIN' }
        : null;
    case 'jwks':
      return null;
    default:
      return assertNever(auth, 'auth.type');
  }
}

type IdentifyFailure = AuthFailure | ApiTokenRefused | ApiTokenWithSession | DatabaseUnavailable;

async function identify(
  request: FastifyRequest,
  { verifier, auth, tokens }: AuthPluginOptions
): Promise<Result<UserContext | null, IdentifyFailure>> {
  const admin = adminFromHeader(request, auth);
  if (admin) return ok(admin);

  const header = request.headers.authorization;
  if (!header) return ok(null);

  const token = bearerOf(header);
  if (!token) {
    return err({
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Invalid Authorization header format: expected Bearer token',
      reason: 'not a bearer header',
    });
  }
  if (isApiTokenCredential(token)) {
    return carriesSession(request) ? err(apiTokenWithSession()) : tokens.authenticate(token);
  }

  const principal = await verifier.verify(token);
  if (isErr(principal)) return principal;

  const { sub, role, email } = principal.value;
  return ok({ id: sub, role: parseRole(role ?? 'user'), ...(email ? { email } : {}) });
}

/** The routes whose contract accepts a party credential; on any other it is never read. */
function partyGuestRoutes(): ReadonlySet<string> {
  return new Set(
    Object.values(contracts)
      .flatMap((group) => Object.values(group).filter(isEndpoint))
      .filter((endpoint) => endpoint.partyGuest === true)
      .map((endpoint) => endpointKey(endpoint.method, endpoint.path))
  );
}

/**
 * A credential that resolves to nothing is refused rather than dropped, so a guest whose seat
 * expired is told so instead of being treated as a stranger to the room.
 */
async function resolveParty(
  request: FastifyRequest,
  { guestSessions, partyCredentialTtlSeconds }: AuthPluginOptions
): Promise<Result<PartyGuestSession | null, CacheUnavailable | WatchPartyCredentialInvalid>> {
  const credential = request.headers[PARTY_CREDENTIAL_HEADER];
  if (typeof credential !== 'string' || credential === '') return ok(null);
  const session = await guestSessions.resolve(credential, partyCredentialTtlSeconds);
  return andThen(session, (found) => (found ? ok(found) : err(watchPartyCredentialInvalid())));
}

/**
 * A refusal of the credential answers any route, so no route's response schema lists it: it is
 * serialized as it is, where the route's schema would fail a code it does not document with a 500.
 */
function refuse<E extends AnyFailure>(
  reply: FastifyReply,
  request: FastifyRequest,
  refused: Result<never, E>,
  options?: SendResultOptions<E>
): FastifyReply {
  reply.serializer(JSON.stringify);
  return sendResult(reply, request, refused, options);
}

async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  app.decorateRequest('user', null);
  app.decorateRequest('party', null);
  app.decorateRequest('actingChannel', null);
  const partyRoutes = partyGuestRoutes();
  const scopes = routeScopes();

  /**
   * Held to the token's rate limit, then to the route's scope; only an admitted request is recorded
   * as a use.
   */
  async function admitToken(
    request: FastifyRequest,
    user: UserContext,
    token: TokenGrant
  ): Promise<Result<void, ApiTokenRateLimited | ApiTokenScopeMissing>> {
    const retryAfter = await options.tokenRateLimit(request);
    if (retryAfter !== null) return err(apiTokenRateLimited(retryAfter));
    const url = request.routeOptions.url;
    const scope = url === undefined ? undefined : scopes.get(endpointKey(request.method, url));
    if (url !== undefined && !canCallWithToken({ user, scope })) {
      return err(apiTokenScopeMissing(scope ?? null));
    }
    ignore(
      await options.tokens.recordUse(token.id),
      'the request still runs; one use goes uncounted'
    );
    return ok();
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const identified = await identify(request, options);
    if (isErr(identified)) return refuse(reply, request, identified);

    if (partyRoutes.has(endpointKey(request.method, request.routeOptions.url ?? ''))) {
      const party = await resolveParty(request, options);
      if (isErr(party)) return refuse(reply, request, party);
      request.party = party.value;
    }

    if (!identified.value) return;

    const header = request.headers[CHANNEL_HEADER];
    const requested = typeof header === 'string' ? header : undefined;
    const { token } = identified.value;
    const resolved = await options.identity.resolve(
      identified.value,
      token?.channelId ?? requested
    );
    if (isErr(resolved)) return refuse(reply, request, resolved);
    const identity = token ? tokenIdentity(resolved.value, token, requested) : resolved;
    if (isErr(identity)) return refuse(reply, request, identity);

    request.user = identity.value.user;
    request.actingChannel = identity.value.acting;
    if (!token) return;

    const admitted = await admitToken(request, identity.value.user, token);
    if (isErr(admitted)) {
      return refuse(reply, request, admitted, {
        headers: (failure): Record<string, string> =>
          failure.code === ErrorCodes.RATE_LIMITED
            ? { 'retry-after': String(failure.retryAfterSeconds) }
            : {},
      });
    }
  });
}

export const registerAuth = fp(authPlugin, {
  name: 'auth-plugin',
});

export function requireAuth(request: FastifyRequest): UserContext {
  if (!request.user) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      'Authentication required to access this resource'
    );
  }
  return request.user;
}

/** The channel a studio route works on: the caller's own, or the one `X-Channel-Id` named. */
export function requireActingChannel(request: FastifyRequest): {
  user: UserContext;
  acting: ActingChannel;
} {
  const user = requireAuth(request);
  const acting = request.actingChannel;
  if (!acting) {
    throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'No acting channel for this request');
  }
  if (isErr(acting)) throw new PermanentError(acting.error.code, acting.error.message);
  return { user, acting: acting.value };
}
