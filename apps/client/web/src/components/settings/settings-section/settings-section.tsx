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
        className={cn('flex flex-col gap-stack', className)}
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
      className={cn('m-0 text-title-lg text-balance', className)}
      {...props}
    />
  );
}

export function SettingsSectionDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="settings-section-description"
      className={cn('m-0 text-body text-fg-muted', className)}
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
        'flex flex-col divide-y divide-border rounded-card border border-border',
        className
      )}
      {...props}
    />
  );
}
