import { Button, type ButtonProps, useUiCopy } from '@vp/ui';
import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, type ComponentType, useMemo } from 'react';
import {
  ErrorIllustration,
  NotFoundIllustration,
  SignedOutIllustration,
} from '../../illustrations';
import { ErrorStateContext, useErrorState } from './error-state.context';
import { errorStateStyles } from './error-state.variants';
import type { ErrorStateKind } from './types';

const KIND_ILLUSTRATIONS = {
  generic: ErrorIllustration,
  server: ErrorIllustration,
  'rate-limited': ErrorIllustration,
  'not-found': NotFoundIllustration,
  forbidden: SignedOutIllustration,
  unauthorised: SignedOutIllustration,
} satisfies Record<ErrorStateKind, ComponentType>;

export interface ErrorStateRootProps extends ComponentPropsWithRef<'div'> {
  kind: ErrorStateKind;
  /** Shows the retry button; a kind that cannot be retried leaves it out. */
  onRetry?: () => void;
}

/** A whole page or route that failed: what went wrong and a way on. */
export function ErrorStateRoot({ kind, onRetry, className, ...props }: ErrorStateRootProps) {
  const shared = useMemo(() => ({ kind, onRetry }), [kind, onRetry]);

  return (
    <ErrorStateContext value={shared}>
      <div data-slot="error-state" className={errorStateStyles().root({ className })} {...props} />
    </ErrorStateContext>
  );
}

/** The drawing for the kind, unless the caller passes its own. */
export function ErrorStateIllustration({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { kind } = useErrorState('Illustration');
  const Drawing = KIND_ILLUSTRATIONS[kind];

  return (
    <div
      data-slot="error-state-illustration"
      aria-hidden="true"
      className={errorStateStyles().illustration({ className })}
      {...props}
    >
      {children ?? <Drawing />}
    </div>
  );
}

export interface ErrorStatePartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading element the caller passes: the page's `h1`, or an `h2` for a part of a page. */
export function ErrorStateTitle({ asChild = false, className, ...props }: ErrorStatePartProps) {
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="error-state-title"
      className={errorStateStyles().title({ className })}
      {...props}
    />
  );
}

export function ErrorStateDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="error-state-description"
      className={errorStateStyles().description({ className })}
      {...props}
    />
  );
}

/** The way on: a link to somewhere safe, with `asChild`, or a button. */
export function ErrorStateAction(props: ButtonProps) {
  return <Button data-slot="error-state-action" variant="outline" {...props} />;
}

/** The root's `onRetry` as a button; nothing when the root has none. */
export function ErrorStateRetry(props: Omit<ButtonProps, 'asChild' | 'onClick'>) {
  const { onRetry } = useErrorState('Retry');
  const { retry } = useUiCopy();

  if (onRetry === undefined) {
    return null;
  }

  return (
    <Button data-slot="error-state-retry" onClick={onRetry} {...props}>
      {retry}
    </Button>
  );
}
