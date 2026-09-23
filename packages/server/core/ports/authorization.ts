import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';

export type PermissionCheckFn<P> = (params: P) => boolean;

/**
 * The verdict, never the refusal. `assertCan` is gone with ADR-24: a service composes
 * `authorize(actor, allowed, context)` from `@vp/domain-rules` and returns the failure instead.
 */
export abstract class AuthorizationPort {
  abstract getAbility(): AppAbility;

  abstract can(action: AppAction, subject: AppSubjects): boolean;
  abstract can<P>(helper: PermissionCheckFn<P>, params: P): boolean;

  abstract forUser(user: UserContext | null): AuthorizationPort;
}
