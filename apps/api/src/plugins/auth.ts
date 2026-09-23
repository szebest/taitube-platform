import * as crypto from 'node:crypto';
import type { AppConfig } from '@vp/env-schema';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { type UserContext, parseRole } from '@vp/permissions';
import { isErr } from '@vp/result';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ServiceSet } from '../composition/services.module';
import type { ChannelService } from '../services/channel-service';
import { verifyUniversalToken } from './jwks-verifier';

const ADMIN_TOKEN_USER: UserContext = {
  id: '00000000-0000-7000-8000-000000000003',
  role: 'ADMIN',
};

/** An unset token admits nobody: there is no default for it to fall back to. */
function matchesAdminToken(header: unknown, expected: string | undefined): boolean {
  if (typeof header !== 'string' || !expected) return false;

  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(header).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );
}

export interface AuthPluginOptions {
  channelService: ChannelService;
  adminToken: string | undefined;
  jwksUrl: string;
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

export async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (matchesAdminToken(request.headers['x-admin-token'], options.adminToken)) {
      request.user = ADMIN_TOKEN_USER;
      return;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      request.user = null;
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new PermanentError(
        ErrorCodes.UNAUTHORIZED,
        'Invalid Authorization header format: expected Bearer token'
      );
    }

    const token = authHeader.slice(7).trim();

    // The catch covers token verification and nothing else. It used to wrap provisioning too,
    // which reported a dead database as `Token verification failed` and answered 401.
    let payload: Awaited<ReturnType<typeof verifyUniversalToken>>;
    try {
      payload = await verifyUniversalToken(token, options.jwksUrl);
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw new PermanentError(
        ErrorCodes.UNAUTHORIZED,
        `Token verification failed: ${(err as Error).message}`
      );
    }

    request.user = {
      id: payload.sub,
      role: parseRole(payload.role || 'user'),
      email: payload.email,
    };

    // A pre-handler runs before any route, so it has no reply to render a Problem into and no
    // `Result` to return. ADR-24 routes it to the backstop instead, which is why this throws.
    const provisioned = await options.channelService.ensureProvisioned(payload.sub, payload.email);
    if (isErr(provisioned)) {
      throw new TransientError(provisioned.error.code, provisioned.error.message);
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
