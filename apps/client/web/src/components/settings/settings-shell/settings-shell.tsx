import { cn, Icon, Slot } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** The settings area: a section navigation beside a content pane from medium up, the pane alone below. */
export function SettingsShellRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="settings-shell"
      className={cn(
        'tw:mx-auto tw:grid tw:w-full tw:max-w-5xl tw:gap-section tw:text-fg tw:medium:grid-cols-[14rem_minmax(0,1fr)]',
        className
      )}
      {...props}
    />
  );
}

/** The section links, `SettingsShell.NavItem`s in a list; on compact the page itself is the list, so it is hidden. */
export function SettingsShellNav({ className, ...props }: ComponentPropsWithRef<'nav'>) {
  return (
    <nav
      data-slot="settings-shell-nav"
      className={cn(
        'tw:hidden tw:medium:sticky tw:medium:inset-bs-header tw:medium:block tw:medium:self-start',
        className
      )}
      {...props}
    />
  );
}

export function SettingsShellNavList({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul
      data-slot="settings-shell-nav-list"
      className={cn('tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1 tw:p-0', className)}
      {...props}
    />
  );
}

export interface SettingsShellNavItemProps extends ComponentPropsWithRef<'a'> {
  /** Marks the section on screen: `aria-current="page"` and the accent ground. */
  active?: boolean;
  /** Takes the link the caller passes, a router `Link`. */
  asChild?: boolean;
}

export function SettingsShellNavItem({
  active = false,
  asChild = false,
  className,
  ...props
}: SettingsShellNavItemProps) {
  const Element = asChild ? Slot.Root : 'a';

  return (
    <li data-slot="settings-shell-nav-item">
      <Element
        aria-current={active ? 'page' : undefined}
        className={cn(
          'tw:flex tw:items-center tw:gap-inline tw:rounded-control tw:px-inset-control tw:py-2 tw:text-label tw:text-fg tw:no-underline tw:focus-ring tw:hover:bg-tint tw:aria-[current=page]:bg-accent-soft tw:aria-[current=page]:text-accent-ink',
          className
        )}
        {...props}
      />
    </li>
  );
}

/** The page beside the navigation; a section page opens with `SettingsShell.Back` on compact. */
export function SettingsShellPane({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="settings-shell-pane"
      className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-section', className)}
      {...props}
    />
  );
}

export interface SettingsShellBackProps extends ComponentPropsWithRef<'a'> {
  /** Takes the link the caller passes, a router `Link` to the overview. */
  asChild?: boolean;
}

/** The way back from a section to the list, shown on compact only. */
export function SettingsShellBack({
  asChild = false,
  className,
  children,
  ...props
}: SettingsShellBackProps) {
  const Element = asChild ? Slot.Root : 'a';

  return (
    <Element
      data-slot="settings-shell-back"
      className={cn(
        'tw:-ms-inset-control tw:inline-flex tw:w-fit tw:items-center tw:gap-1 tw:rounded-control tw:px-inset-control tw:py-2 tw:text-label tw:text-accent-ink tw:no-underline tw:focus-ring tw:medium:hidden',
        className
      )}
      {...props}
    >
      <Icon name="chevron-left" size="md" className="tw:rtl:rotate-180" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}
