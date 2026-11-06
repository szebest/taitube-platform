import * as crypto from 'node:crypto';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import type { AuthFailure, TokenVerifier } from '@vp/core/ports';
import type { ActingChannel } from '@vp/domain';
import type { ChannelMembershipRequired } from '@vp/domain-rules';
import type { AppConfig, AuthConfig } from '@vp/env-schema';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { type Result, assertNever, err, isErr, ok } from '@vp/result';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import { sendResult } from '../routes/send-result';
import type { RequestIdentity } from '../services/request-identity';

export interface AuthPluginOptions {
  identity: RequestIdentity;
  verifier: TokenVerifier;
  auth: AuthConfig;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null;
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

async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  app.decorateRequest('user', null);
  app.decorateRequest('actingChannel', null);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const identified = await identify(request, options);
    if (isErr(identified)) return sendResult(reply, request, identified);

    if (!identified.value) return;

    const requested = request.headers[CHANNEL_HEADER];
    const resolved = await options.identity.resolve(
      identified.value,
      typeof requested === 'string' ? requested : undefined
    );
    if (isErr(resolved)) return sendResult(reply, request, resolved);

    request.user = resolved.value.user;
    request.actingChannel = resolved.value.acting;
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
