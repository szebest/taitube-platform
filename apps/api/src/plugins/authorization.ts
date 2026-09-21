import {
  type Action,
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type Resource,
  type UserContext,
  assertCan,
  can,
  getUserPermissions,
  parseRole,
} from '@vp/permissions';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type ResourceResolver<R extends Resource = Resource> = (
  request: FastifyRequest
) => Promise<R | undefined> | R | undefined;

export type AuthorizationPreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

export type ActionOrHelper<R extends Resource = Resource> =
  | Action
  | AppAction
  | ((params: { user: UserContext | null } & R) => boolean);

export function toUserContext(request: FastifyRequest): UserContext | null {
  const authUser = request.user;
  if (!authUser) return null;
  return {
    id: authUser.id,
    role: parseRole(authUser.role),
    email: authUser.email,
  };
}

export function authorize<R extends Resource = Resource>(
  actionOrHelper: ActionOrHelper<R>,
  resourceResolver?: ResourceResolver<R>
): AuthorizationPreHandler {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    let resource: R | undefined;
    if (resourceResolver) {
      resource = await resourceResolver(request);
    }

    evaluateAssertCan(request, actionOrHelper, resource);
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    authorize: <R extends Resource = Resource>(
      actionOrHelper: ActionOrHelper<R>,
      resourceResolver?: ResourceResolver<R>
    ) => AuthorizationPreHandler;
    verifyPermission: <R extends Resource = Resource>(
      actionOrHelper: ActionOrHelper<R>,
      resourceResolver?: ResourceResolver<R>
    ) => AuthorizationPreHandler;
  }
  interface FastifyRequest {
    readonly ability: AppAbility;
    can(action: AppAction, subject: AppSubjects): boolean;
    can<R extends Resource = Resource>(action: Action, resource?: R): boolean;
    can<P extends { user: UserContext | null }>(
      helper: (params: P) => boolean,
      params?: Omit<P, 'user'>
    ): boolean;

    assertCan(action: AppAction, subject: AppSubjects, message?: string): void;
    assertCan<R extends Resource = Resource>(action: Action, resource?: R, message?: string): void;
    assertCan<P extends { user: UserContext | null }>(
      helper: (params: P) => boolean,
      params?: Omit<P, 'user'>,
      message?: string
    ): void;

    authorize(action: AppAction, subject: AppSubjects): Promise<void>;
    authorize<R extends Resource = Resource>(action: Action, resource?: R): Promise<void>;
    authorize<P extends { user: UserContext | null }>(
      helper: (params: P) => boolean,
      params?: Omit<P, 'user'>
    ): Promise<void>;
  }
}

function evaluateCan(
  request: FastifyRequest,
  actionOrHelper: unknown,
  subjectOrParams?: unknown
): boolean {
  const userContext = toUserContext(request);

  if (typeof actionOrHelper === 'function') {
    const helper = actionOrHelper as (params: unknown) => boolean;
    const params =
      typeof subjectOrParams === 'object' && subjectOrParams !== null
        ? { ...subjectOrParams, user: userContext }
        : { user: userContext };
    return helper(params);
  }

  const actionStr = String(actionOrHelper);
  if (
    (actionStr === 'manage' ||
      actionStr === 'read' ||
      actionStr === 'create' ||
      actionStr === 'update' ||
      actionStr === 'delete' ||
      actionStr === 'publish' ||
      actionStr === 'react' ||
      actionStr === 'pin' ||
      actionStr === 'subscribe' ||
      actionStr === 'access') &&
    (typeof subjectOrParams === 'string' || !actionStr.includes(':'))
  ) {
    return request.ability.can(actionStr as AppAction, subjectOrParams as AppSubjects);
  }

  return can(userContext, actionStr as Action, subjectOrParams as Resource | undefined);
}

function evaluateAssertCan(
  request: FastifyRequest,
  actionOrHelper: unknown,
  subjectOrParams?: unknown,
  message?: string
): void {
  const userContext = toUserContext(request);
  const allowed = evaluateCan(request, actionOrHelper, subjectOrParams);

  const actionName =
    typeof actionOrHelper === 'function'
      ? actionOrHelper.name || 'execute'
      : String(actionOrHelper);

  const subjectName =
    typeof subjectOrParams === 'string'
      ? subjectOrParams
      : typeof subjectOrParams === 'object' && subjectOrParams !== null
        ? ((subjectOrParams as { constructor?: { name?: string } }).constructor?.name ?? 'Resource')
        : 'Resource';

  assertCan(allowed, {
    action: actionName,
    subject: subjectName,
    user: userContext,
    message,
  });
}

export async function authorizationPlugin(app: FastifyInstance): Promise<void> {
  app.decorate('authorize', authorize);
  app.decorate('verifyPermission', authorize);

  const abilityMap = new WeakMap<FastifyRequest, AppAbility>();

  app.decorateRequest('ability', {
    getter(this: FastifyRequest): AppAbility {
      let ability = abilityMap.get(this);
      if (!ability) {
        const userContext = toUserContext(this);
        ability = getUserPermissions(userContext);
        abilityMap.set(this, ability);
      }
      return ability;
    },
  });

  app.decorateRequest(
    'can',
    function (this: FastifyRequest, actionOrHelper: unknown, subjectOrParams?: unknown): boolean {
      return evaluateCan(this, actionOrHelper, subjectOrParams);
    }
  );

  app.decorateRequest(
    'assertCan',
    function (
      this: FastifyRequest,
      actionOrHelper: unknown,
      subjectOrParams?: unknown,
      message?: string
    ): void {
      evaluateAssertCan(this, actionOrHelper, subjectOrParams, message);
    }
  );

  app.decorateRequest(
    'authorize',
    async function (
      this: FastifyRequest,
      actionOrHelper: unknown,
      subjectOrParams?: unknown
    ): Promise<void> {
      evaluateAssertCan(this, actionOrHelper, subjectOrParams);
    }
  );
}

export const registerAuthorization = fp(authorizationPlugin, {
  name: 'authorization-plugin',
  dependencies: ['auth-plugin'],
});
