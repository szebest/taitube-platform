import { AuthorizationPort, type PermissionCheckFn } from '@vp/core/ports';
import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
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

  override forUser(user: UserContext | null): StrictAuthorizationAdapter {
    return new StrictAuthorizationAdapter(user);
  }
}
