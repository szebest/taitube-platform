import { cn, Icon } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';

import { SettingRowContext, useSettingRow } from './setting-row.context';

export interface SettingRowRootProps extends ComponentPropsWithRef<'fieldset'> {
  /** Marks the row a search result opened. */
  highlighted?: boolean;
}

/** One setting: its label and description beside its control, and a status line when something needs saying. */
export function SettingRowRoot({ highlighted = false, className, ...props }: SettingRowRootProps) {
  const labelId = useId();

  return (
    <SettingRowContext value={{ labelId }}>
      <fieldset
        data-slot="setting-row"
        aria-labelledby={labelId}
        data-highlighted={highlighted || undefined}
        className={cn(
          'm-0 grid min-w-0 scroll-mt-header border-0 gap-stack p-inset-card data-highlighted:bg-accent-soft medium:grid-cols-[minmax(0,1fr)_auto] medium:items-center',
          className
        )}
        {...props}
      />
    </SettingRowContext>
  );
}

/** The label and the description under it, kept together beside the control. */
export function SettingRowText({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="setting-row-text"
      className={cn('flex min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

export function SettingRowLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { labelId } = useSettingRow('Label');

  return (
    <span
      data-slot="setting-row-label"
      id={labelId}
      className={cn('block text-label text-fg', className)}
      {...props}
    />
  );
}

export function SettingRowDescription({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="setting-row-description"
      className={cn('block text-body-sm text-fg-muted', className)}
      {...props}
    />
  );
}

/** The control that changes the setting, which keeps its own accessible name. */
export function SettingRowControl({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="setting-row-control"
      className={cn('flex min-w-0 items-center gap-inline', className)}
      {...props}
    />
  );
}

/** What is wrong with the setting, such as a save that failed; the row is not left to look fine. */
export function SettingRowStatus({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="setting-row-status"
      role="status"
      className={cn(
        'm-0 flex items-center gap-1 text-body-sm text-warning-ink medium:col-span-full',
        className
      )}
      {...props}
    >
      <Icon name="alert" size="sm" />
      {children}
    </p>
  );
}
