import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { assertNever } from '@vp/result';
import type { ReactNode } from 'react';
import { type PermissionsContextValue, usePermissions } from './permissions-provider';
import { allows, type CanHelper } from './use-can';

type CanSlot = {
  fallback?: ReactNode;
  children: ReactNode;
};

export type CanProps<P extends { user: UserContext | null }> =
  | (CanSlot & { type: 'rule'; I: CanHelper<P>; this?: Omit<P, 'user'> })
  | (CanSlot & { type: 'ability'; do: AppAction; on: AppSubjects });

function allowedBy<P extends { user: UserContext | null }>(
  props: CanProps<P>,
  permissions: PermissionsContextValue
): boolean {
  switch (props.type) {
    case 'rule':
      return allows(permissions, props.I, props.this);
    case 'ability':
      return allows(permissions, props.do, props.on);
    default:
      return assertNever(props, 'CanProps');
  }
}

export function Can<P extends { user: UserContext | null }>(props: CanProps<P>): ReactNode {
  return allowedBy(props, usePermissions()) ? props.children : (props.fallback ?? null);
}
