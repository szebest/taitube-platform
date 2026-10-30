import * as crypto from 'node:crypto';
import type { AuthFailure, TokenVerifier } from '@vp/core/ports';
import type { AppConfig, AuthConfig } from '@vp/env-schema';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { type Result, assertNever, err, isErr, ok } from '@vp/result';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import { sendResult } from '../routes/send-result';
import type { ChannelService } from '../services/channel-service';

export interface AuthPluginOptions {
  channelService: ChannelService;
  verifier: TokenVerifier;
  auth: AuthConfig;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null;
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

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const identified = await identify(request, options);
    if (isErr(identified)) return sendResult(reply, request, identified);

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
