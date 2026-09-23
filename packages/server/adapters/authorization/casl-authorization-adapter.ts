import { AuthorizationPort, type PermissionCheckFn } from '@vp/core/ports';
import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
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

  override forUser(user: UserContext | null): CaslAuthorizationAdapter {
    return new CaslAuthorizationAdapter(user);
  }
}
