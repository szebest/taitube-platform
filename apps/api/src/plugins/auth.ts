import * as crypto from 'node:crypto';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ChannelService } from '../services/channel-service';
import { verifyUniversalToken } from './jwks-verifier';

const ADMIN_TOKEN_USER: AuthUser = {
  id: '00000000-0000-7000-8000-000000000003',
  role: 'admin',
};

function matchesAdminToken(header: unknown): boolean {
  if (typeof header !== 'string') return false;

  const expected = process.env.ADMIN_TOKEN || 'change-me-32-bytes-random';
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(header).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );
}

export interface AuthUser {
  id: string;
  role: string;
  email?: string;
}

export interface AuthPluginOptions {
  channelService?: ChannelService;
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
    if (matchesAdminToken(request.headers['x-admin-token'])) {
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

    try {
      const payload = await verifyUniversalToken(token, options.jwksUrl);
      request.user = {
        id: payload.sub,
        role: payload.role || 'user',
        email: payload.email,
      };

      await options.channelService?.ensureProvisioned(payload.sub, payload.email);
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
