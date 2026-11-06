import { cn, Progress, type ProgressProps } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** A goal over video: its label and count above a bar, on the scrim. */
export function GoalBarRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="goal-bar"
      className={cn(
        'grid grid-cols-[1fr_auto] items-baseline gap-inline rounded-card bg-scrim p-inset-card text-fg',
        className
      )}
      {...props}
    />
  );
}

export function GoalBarLabel({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p data-slot="goal-bar-label" className={cn('m-0 text-title', className)} {...props} />
  );
}

export function GoalBarCount({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="goal-bar-count"
      className={cn('m-0 text-title tabular-nums', className)}
      {...props}
    />
  );
}

export type GoalBarBarProps = ProgressProps & { 'aria-label': string };

export function GoalBarBar({ className, ...props }: GoalBarBarProps) {
  return <Progress size="lg" className={cn('col-span-2', className)} {...props} />;
}
