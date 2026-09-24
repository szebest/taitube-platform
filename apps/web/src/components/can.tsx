import type { ReactNode } from 'react';
import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { assertNever } from '@vp/result';
import { useCan, type CanHelper } from '../hooks/use-can';

type CanSlot = {
  fallback?: ReactNode;
  children: ReactNode;
};

export type CanProps<P extends { user: UserContext | null }> =
  | (CanSlot & { type: 'rule'; I: CanHelper<P>; this?: Omit<P, 'user'> })
  | (CanSlot & { type: 'ability'; do: AppAction; on: AppSubjects });

function useAllowed<P extends { user: UserContext | null }>(props: CanProps<P>): boolean {
  // Every branch calls useCan exactly once, so the hook order holds when `type` changes.
  switch (props.type) {
    case 'rule':
      return useCan(props.I, props.this);
    case 'ability':
      return useCan(props.do, props.on);
    default:
      return assertNever(props, 'CanProps');
  }
}

export function Can<P extends { user: UserContext | null }>(props: CanProps<P>): ReactNode {
  return useAllowed(props) ? props.children : (props.fallback ?? null);
}
