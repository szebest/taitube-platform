import { Button, type ButtonProps } from '@vp/ui';
import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { EmptyStateContext, useEmptyState } from './empty-state.context';
import { emptyStateStyles } from './empty-state.variants';
import type { EmptyStateSize, EmptyStateTitleStyle } from './types';

export interface EmptyStateRootProps extends ComponentPropsWithRef<'div'> {
  size?: EmptyStateSize;
  titleStyle?: EmptyStateTitleStyle;
}

/** One editorial line and one action; `role="status"` when it appears after a filter or a search. */
export function EmptyStateRoot({
  size = 'page',
  titleStyle = 'title-lg',
  className,
  ...props
}: EmptyStateRootProps) {
  const shared = useMemo(() => ({ size, titleStyle }), [size, titleStyle]);

  return (
    <EmptyStateContext value={shared}>
      <div
        data-slot="empty-state"
        className={emptyStateStyles(shared).root({ className })}
        {...props}
      />
    </EmptyStateContext>
  );
}

export function EmptyStateIllustration({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const shared = useEmptyState('Illustration');

  return (
    <div
      data-slot="empty-state-illustration"
      aria-hidden="true"
      className={emptyStateStyles(shared).illustration({ className })}
      {...props}
    />
  );
}

export interface EmptyStatePartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading element the caller passes, as the single child with `asChild`. */
export function EmptyStateTitle({ asChild = false, className, ...props }: EmptyStatePartProps) {
  const shared = useEmptyState('Title');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="empty-state-title"
      className={emptyStateStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function EmptyStateDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useEmptyState('Description');

  return (
    <p
      data-slot="empty-state-description"
      className={emptyStateStyles(shared).description({ className })}
      {...props}
    />
  );
}

/** The one primary action: a button, or with `asChild` the link that acts as one. */
export function EmptyStateAction(props: ButtonProps) {
  return <Button data-slot="empty-state-action" {...props} />;
}

export interface EmptyStateSecondaryProps extends ComponentPropsWithRef<'a'> {
  asChild?: boolean;
}

export function EmptyStateSecondary({
  asChild = false,
  className,
  ...props
}: EmptyStateSecondaryProps) {
  const shared = useEmptyState('Secondary');
  const Element = asChild ? Slot.Root : 'a';

  return (
    <Element
      data-slot="empty-state-secondary"
      className={emptyStateStyles(shared).secondary({ className })}
      {...props}
    />
  );
}
