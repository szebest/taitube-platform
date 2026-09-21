import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';

export interface AuthorizationOptions {
  action: string;
  subject: string;
  user?: UserContext | null;
  message?: string;
}

export type PermissionCheckFn<P> = (params: P) => boolean;

export abstract class AuthorizationPort {
  abstract getAbility(): AppAbility;

  abstract can(action: AppAction, subject: AppSubjects): boolean;
  abstract can<P>(helper: PermissionCheckFn<P>, params: P): boolean;

  abstract assertCan(action: AppAction, subject: AppSubjects, message?: string): void;
  abstract assertCan<P>(
    helper: PermissionCheckFn<P>,
    params: P,
    options: AuthorizationOptions
  ): void;

  abstract forUser(user: UserContext | null): AuthorizationPort;
}
