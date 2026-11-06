import { cn, Progress, type ProgressProps } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** A goal over video: its label and count above a bar, on the scrim. */
export function GoalBarRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="goal-bar"
      className={cn(
        'tw:grid tw:grid-cols-[1fr_auto] tw:items-baseline tw:gap-inline tw:rounded-card tw:bg-scrim tw:p-inset-card tw:text-fg',
        className
      )}
      {...props}
    />
  );
}

export function GoalBarLabel({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p data-slot="goal-bar-label" className={cn('tw:m-0 tw:text-title', className)} {...props} />
  );
}

export function GoalBarCount({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="goal-bar-count"
      className={cn('tw:m-0 tw:text-title tw:tabular-nums', className)}
      {...props}
    />
  );
}

export type GoalBarBarProps = ProgressProps & { 'aria-label': string };

export function GoalBarBar({ className, ...props }: GoalBarBarProps) {
  return <Progress size="lg" className={cn('tw:col-span-2', className)} {...props} />;
}
