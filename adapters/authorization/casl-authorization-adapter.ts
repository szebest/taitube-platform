import {
  type AuthorizationOptions,
  AuthorizationPort,
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

export class CaslAuthorizationAdapter extends AuthorizationPort {
  private readonly ability: AppAbility;
  private readonly user: UserContext | null;

  constructor(user: UserContext | null = null, ability?: AppAbility) {
    super();
    this.user = user;
    this.ability = ability ?? getUserPermissions(user);
  }

  override getAbility(): AppAbility {
    return this.ability;
  }

  override can(action: AppAction, subject: AppSubjects): boolean;
  override can<P>(helper: PermissionCheckFn<P>, params: P): boolean;
  override can<P>(
    actionOrHelper: AppAction | PermissionCheckFn<P>,
    subjectOrParams: AppSubjects | P
  ): boolean {
    if (typeof actionOrHelper === 'function') {
      return actionOrHelper(subjectOrParams as P);
    }
    return this.ability.can(actionOrHelper, subjectOrParams as AppSubjects);
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
      const allowed = actionOrHelper(subjectOrParams as P);
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
      assertCan(allowed, {
        action: opts.action,
        subject: opts.subject,
        user: effectiveUser,
        message: opts.message,
      });
      return;
    }

    const action = actionOrHelper;
    const subject = subjectOrParams as AppSubjects;
    const allowed = this.ability.can(action, subject);
    const message =
      typeof optionsOrMessage === 'string' ? optionsOrMessage : optionsOrMessage?.message;
    const subjectName = typeof subject === 'string' ? subject : 'Resource';

    assertCan(allowed, {
      action,
      subject: subjectName,
      user: this.user,
      message,
    });
  }

  override forUser(user: UserContext | null): CaslAuthorizationAdapter {
    return new CaslAuthorizationAdapter(user);
  }
}
