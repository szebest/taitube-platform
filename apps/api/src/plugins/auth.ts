import { verifyDevToken } from '@vp/dev-token';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface AuthUser {
  id: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
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
      const payload = verifyDevToken(token);
      request.user = {
        id: payload.sub,
        role: payload.role || 'user',
      };
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
