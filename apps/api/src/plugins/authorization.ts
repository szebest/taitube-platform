import { type Action, can, type Resource, type UserContext } from '@vp/core/permissions';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type ResourceResolver<R extends Resource = Resource> = (
  request: FastifyRequest
) => Promise<R | undefined> | R | undefined;

export type AuthorizationPreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

export function authorize(
  action: Action,
  resourceResolver?: ResourceResolver
): AuthorizationPreHandler {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authUser = request.user;
    const userContext: UserContext | null = authUser
      ? {
          id: authUser.id,
          role: authUser.role,
          email: authUser.email,
        }
      : null;

    let resource: Resource | undefined;
    if (resourceResolver) {
      resource = await resourceResolver(request);
    }

    const allowed = can(userContext, action, resource);
    if (!allowed) {
      if (!userContext) {
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          `Authentication required to perform action '${action}'`
        );
      }
      throw new PermanentError(
        ErrorCodes.FORBIDDEN,
        `Forbidden: role '${userContext.role}' cannot perform action '${action}'`
      );
    }
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    authorize: (action: Action, resourceResolver?: ResourceResolver) => AuthorizationPreHandler;
    verifyPermission: (
      action: Action,
      resourceResolver?: ResourceResolver
    ) => AuthorizationPreHandler;
  }
  interface FastifyRequest {
    authorize: (action: Action, resource?: Resource) => Promise<void>;
  }
}

export async function authorizationPlugin(app: FastifyInstance): Promise<void> {
  app.decorate('authorize', authorize);
  app.decorate('verifyPermission', authorize);

  app.decorateRequest(
    'authorize',
    async function (this: FastifyRequest, action: Action, resource?: Resource): Promise<void> {
      const authUser = this.user;
      const userContext: UserContext | null = authUser
        ? {
            id: authUser.id,
            role: authUser.role,
            email: authUser.email,
          }
        : null;

      const allowed = can(userContext, action, resource);
      if (!allowed) {
        if (!userContext) {
          throw new PermanentError(
            ErrorCodes.UNAUTHORIZED,
            `Authentication required to perform action '${action}'`
          );
        }
        throw new PermanentError(
          ErrorCodes.FORBIDDEN,
          `Forbidden: role '${userContext.role}' cannot perform action '${action}'`
        );
      }
    }
  );
}

export const registerAuthorization = fp(authorizationPlugin, {
  name: 'authorization-plugin',
  dependencies: ['auth-plugin'],
});
