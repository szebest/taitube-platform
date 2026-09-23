import * as crypto from 'node:crypto';
import type { AuthFailure, TokenVerifier } from '@vp/core/ports';
import type { AppConfig } from '@vp/env-schema';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { type Result, err, isErr, ok } from '@vp/result';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import { sendResult } from '../routes/send-result';
import type { ChannelService } from '../services/channel-service';

export interface AdminCredential {
  token: string;
  userId: string;
}

export interface AuthPluginOptions {
  channelService: ChannelService;
  verifier: TokenVerifier;
  admin: AdminCredential | undefined;
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

/** Only dev mode has a static admin credential; production admins carry a verified role claim. */
export function adminCredential(auth: AppConfig['auth']): AdminCredential | undefined {
  switch (auth.type) {
    case 'dev':
      return auth.adminToken ? { token: auth.adminToken, userId: auth.adminUserId } : undefined;
    case 'jwks':
      return undefined;
  }
}

function matchesAdminToken(header: unknown, admin: AdminCredential | undefined): boolean {
  if (typeof header !== 'string' || !admin) return false;

  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(header).digest(),
    crypto.createHash('sha256').update(admin.token).digest()
  );
}

const BEARER = /^Bearer (.+)$/;

async function identify(
  request: FastifyRequest,
  { verifier, admin }: AuthPluginOptions
): Promise<Result<UserContext | null, AuthFailure>> {
  if (admin && matchesAdminToken(request.headers['x-admin-token'], admin)) {
    return ok({ id: admin.userId, role: 'ADMIN' });
  }

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

export async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
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
