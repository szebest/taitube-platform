import type { ReactElement, ReactNode } from 'react';
import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { useCan, type CanHelper } from '../hooks/use-can';

export type CanProps<P extends { user: UserContext | null }> =
  | {
      I: CanHelper<P>;
      this?: Omit<P, 'user'>;
      do?: never;
      on?: never;
      fallback?: ReactNode;
      children: ReactNode;
    }
  | {
      do: AppAction;
      on: AppSubjects;
      I?: never;
      this?: never;
      fallback?: ReactNode;
      children: ReactNode;
    };

/**
 * Headless slot component for declarative permission-gated rendering.
 * Renders children only when the provided declarative permission evaluates to true.
 * Enforces Rule 14: Headless UI authorization with zero inline permission checks in JSX.
 */
export function Can<P extends { user: UserContext | null }>(
  props: CanProps<P>
): ReactNode {
  const allowed =
    'do' in props && props.do !== undefined
      ? useCan(props.do, props.on)
      : useCan(props.I, (props.this ?? {}) as Omit<P, 'user'>);

  if (!allowed) {
    return props.fallback ?? null;
  }

  return props.children;
}
