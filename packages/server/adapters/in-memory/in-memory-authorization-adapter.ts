import {
  AuthorizationPort,
  type AuthorizationOptions,
  type PermissionCheckFn,
} from '@vp/core/ports';
import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
  assertCan,
  getUserPermissions,
} from '@vp/permissions';

export class PermissiveAuthorizationAdapter extends AuthorizationPort {
  private readonly ability: AppAbility;

  constructor() {
    super();
    this.ability = getUserPermissions({ id: 'mock-admin', role: 'ADMIN' });
  }

  override getAbility(): AppAbility {
    return this.ability;
  }

  override can(action: AppAction, subject: AppSubjects): boolean;
  override can<P>(helper: PermissionCheckFn<P>, params: P): boolean;
  override can<P>(
    _actionOrHelper: AppAction | PermissionCheckFn<P>,
    _subjectOrParams: AppSubjects | P
  ): boolean {
    return true;
  }

  override assertCan(action: AppAction, subject: AppSubjects, message?: string): void;
  override assertCan<P>(
    helper: PermissionCheckFn<P>,
    params: P,
    options: AuthorizationOptions
  ): void;
  override assertCan<P>(
    _actionOrHelper: AppAction | PermissionCheckFn<P>,
    _subjectOrParams: AppSubjects | P,
    _optionsOrMessage?: AuthorizationOptions | string
  ): void {
    // Permissive: always succeeds
  }

  override forUser(_user: UserContext | null): PermissiveAuthorizationAdapter {
    return this;
  }
}

export class StrictAuthorizationAdapter extends AuthorizationPort {
  private readonly ability: AppAbility;
  private readonly user: UserContext | null;

  constructor(user: UserContext | null = null) {
    super();
    this.user = user;
    this.ability = getUserPermissions(null);
  }

  override getAbility(): AppAbility {
    return this.ability;
  }

  override can(action: AppAction, subject: AppSubjects): boolean;
  override can<P>(helper: PermissionCheckFn<P>, params: P): boolean;
  override can<P>(
    _actionOrHelper: AppAction | PermissionCheckFn<P>,
    _subjectOrParams: AppSubjects | P
  ): boolean {
    return false;
  }

  override assertCan(action: AppAction, subject: AppSubjects, message?: string): void;
  override assertCan<P>(
    helper: PermissionCheckFn<P>,
    params: P,
    options: AuthorizationOptions
  ): void;
  override assertCan<P>(
    actionOrHelper: AppAction | PermissionCheckFn<P>,
    subjectOrParams: AppSubjects | P,
    optionsOrMessage?: AuthorizationOptions | string
  ): void {
    if (typeof actionOrHelper === 'function') {
      const opts: AuthorizationOptions =
        typeof optionsOrMessage === 'object' && optionsOrMessage !== null
          ? optionsOrMessage
          : {
              action: actionOrHelper.name || 'execute',
              subject: 'Resource',
            };
      const userFromParams = (subjectOrParams as { user?: UserContext | null }).user;
      const effectiveUser =
        opts.user !== undefined
          ? opts.user
          : userFromParams !== undefined
            ? userFromParams
            : this.user;
      assertCan(false, {
        action: opts.action,
        subject: opts.subject,
        user: effectiveUser,
        message: opts.message,
      });
      return;
    }

    const action = actionOrHelper;
    const subject = subjectOrParams as AppSubjects;
    const message =
      typeof optionsOrMessage === 'string' ? optionsOrMessage : optionsOrMessage?.message;
    const subjectName = typeof subject === 'string' ? subject : 'Resource';

    assertCan(false, {
      action,
      subject: subjectName,
      user: this.user,
      message,
    });
  }

  override forUser(user: UserContext | null): StrictAuthorizationAdapter {
    return new StrictAuthorizationAdapter(user);
  }
}
