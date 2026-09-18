import * as crypto from 'node:crypto';
import type { Repositories } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ensureUserAndChannelProvisioned } from './jit-provisioner';
import { verifyUniversalToken } from './jwks-verifier';

export interface AuthUser {
  id: string;
  role: string;
  email?: string;
}

export interface AuthPluginOptions {
  repositories?: Repositories;
  jwksUrl?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export async function authPlugin(
  app: FastifyInstance,
  options: AuthPluginOptions = {}
): Promise<void> {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
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

    try {
      const payload = await verifyUniversalToken(token, options.jwksUrl);
      request.user = {
        id: payload.sub,
        role: payload.role || 'user',
        email: payload.email,
      };

      if (options.repositories) {
        await ensureUserAndChannelProvisioned(options.repositories, payload.sub, payload.email);
      }
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw new PermanentError(
        ErrorCodes.UNAUTHORIZED,
        `Token verification failed: ${(err as Error).message}`
      );
    }
  });
}

export const registerAuth = fp(authPlugin, {
  name: 'auth-plugin',
});

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      'Authentication required to access this resource'
    );
  }
  return request.user;
}

export function requireAdmin(request: FastifyRequest): AuthUser {
  // 1. Check x-admin-token header with constant-time comparison (AC 17)
  const adminTokenHeader = request.headers['x-admin-token'];
  const expectedAdminToken = process.env.ADMIN_TOKEN || 'change-me-32-bytes-random';

  if (typeof adminTokenHeader === 'string') {
    const hashA = crypto.createHash('sha256').update(adminTokenHeader).digest();
    const hashB = crypto.createHash('sha256').update(expectedAdminToken).digest();
    if (crypto.timingSafeEqual(hashA, hashB)) {
      return {
        id: '00000000-0000-7000-8000-000000000003',
        role: 'admin',
      };
    }
  }

  // 2. Unauthenticated check (AC 17)
  if (!request.user) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      'Authentication required: provide an admin Bearer token or valid x-admin-token header'
    );
  }

  // 3. Role check: non-admin JWT -> 403 Forbidden (AC 17)
  if (request.user.role?.toLowerCase() !== 'admin') {
    throw new PermanentError(ErrorCodes.FORBIDDEN, 'Admin role required to access this resource');
  }

  return request.user;
}
