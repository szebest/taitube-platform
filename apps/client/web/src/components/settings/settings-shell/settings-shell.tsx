import { cn, Icon, Slot } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** The settings area: a section navigation beside a content pane from medium up, the pane alone below. */
export function SettingsShellRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="settings-shell"
      className={cn(
        'mx-auto grid w-full max-w-content-max gap-section text-fg medium:grid-cols-[14rem_minmax(0,1fr)]',
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
        'hidden medium:sticky medium:inset-bs-header medium:block medium:self-start',
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
      className={cn('m-0 flex list-none flex-col gap-1 p-0', className)}
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
          'flex items-center gap-inline rounded-control px-inset-control py-2 text-label text-fg no-underline focus-ring hover:bg-tint aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink',
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
      className={cn('flex min-w-0 flex-col gap-section', className)}
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
        '-ms-inset-control inline-flex w-fit items-center gap-1 rounded-control px-inset-control py-2 text-label text-accent-ink no-underline focus-ring medium:hidden',
        className
      )}
      {...props}
    >
      <Icon name="chevron-left" size="md" className="rtl:rotate-180" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}
