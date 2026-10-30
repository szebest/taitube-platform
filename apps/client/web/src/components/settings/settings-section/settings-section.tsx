import { cn, Slot } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';

import { SettingsSectionContext, useSettingsSection } from './settings-section.context';

/** One section of settings: a heading, a line under it and its rows. */
export function SettingsSectionRoot({ className, ...props }: ComponentPropsWithRef<'section'>) {
  const titleId = useId();

  return (
    <SettingsSectionContext value={{ titleId }}>
      <section
        data-slot="settings-section"
        aria-labelledby={titleId}
        className={cn('tw:flex tw:flex-col tw:gap-stack', className)}
        {...props}
      />
    </SettingsSectionContext>
  );
}

export interface SettingsSectionTitleProps extends ComponentPropsWithRef<'h2'> {
  /** Takes the heading the caller passes, so the page picks the level. */
  asChild?: boolean;
}

export function SettingsSectionTitle({
  asChild = false,
  className,
  ...props
}: SettingsSectionTitleProps) {
  const { titleId } = useSettingsSection('Title');
  const Element = asChild ? Slot.Root : 'h2';

  return (
    <Element
      data-slot="settings-section-title"
      id={titleId}
      className={cn('tw:m-0 tw:text-title-lg tw:text-balance', className)}
      {...props}
    />
  );
}

export function SettingsSectionDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="settings-section-description"
      className={cn('tw:m-0 tw:text-body tw:text-fg-muted', className)}
      {...props}
    />
  );
}

/** The rows, one `SettingRow.Root` after another, set apart by a hairline. */
export function SettingsSectionBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="settings-section-body"
      className={cn(
        'tw:flex tw:flex-col tw:divide-y tw:divide-border tw:rounded-card tw:border tw:border-border',
        className
      )}
      {...props}
    />
  );
}
