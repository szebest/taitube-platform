import * as crypto from 'node:crypto';
import { contracts, endpointKey, isEndpoint, PARTY_CREDENTIAL_HEADER } from '@vp/api-contracts';
import type {
  AuthFailure,
  PartyGuestSession,
  PartyGuestSessionsPort,
  TokenVerifier,
} from '@vp/core/ports';
import type { AppConfig, AuthConfig } from '@vp/env-schema';
import {
  type CacheUnavailable,
  ErrorCodes,
  PermanentError,
  type WatchPartyCredentialInvalid,
  watchPartyCredentialInvalid,
} from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { type Result, andThen, assertNever, err, isErr, ok } from '@vp/result';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import { sendResult } from '../routes/send-result';
import type { ChannelService } from '../services/channel-service';

export interface AuthPluginOptions {
  channelService: ChannelService;
  verifier: TokenVerifier;
  auth: AuthConfig;
  guestSessions: PartyGuestSessionsPort;
  /** Every resolve slides a party credential's life forward this far. */
  partyCredentialTtlSeconds: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null;
    /** A guest's or a Discord member's party credential, resolved only on `partyGuest` routes. */
    party: PartyGuestSession | null;
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

const BEARER = /^Bearer (.+)$/;

async function identify(
  request: FastifyRequest,
  { verifier, auth }: AuthPluginOptions
): Promise<Result<UserContext | null, AuthFailure>> {
  const admin = adminFromHeader(request, auth);
  if (admin) return ok(admin);

  const header = request.headers.authorization;
  if (!header) return ok(null);

  const token = BEARER.exec(header)?.[1]?.trim();
  if (!token) {
    return err({
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Invalid Authorization header format: expected Bearer token',
      reason: 'not a bearer header',
    });
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

async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  app.decorateRequest('user', null);
  app.decorateRequest('party', null);
  const partyRoutes = partyGuestRoutes();

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const identified = await identify(request, options);
    if (isErr(identified)) return sendResult(reply, request, identified);

    if (partyRoutes.has(endpointKey(request.method, request.routeOptions.url ?? ''))) {
      const party = await resolveParty(request, options);
      if (isErr(party)) return sendResult(reply, request, party);
      request.party = party.value;
    }

    request.user = identified.value;
    if (!identified.value) return;

    const { id, email } = identified.value;
    const provisioned = await options.channelService.ensureProvisioned(id, email);
    if (isErr(provisioned)) return sendResult(reply, request, provisioned);
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
