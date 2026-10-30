import { Drawer, Icon, type IconId, Slot, Tooltip, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useStudioWorkspace } from './studio-workspace.context';
import { studioWorkspaceStyles } from './studio-workspace.variants';

const NAV_ITEM = '[data-slot="studio-workspace-nav-item"]';

/** Up and down arrows move between the items, as in a menu, with Home and End at the ends. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(NAV_ITEM)];
  const current = event.target instanceof HTMLElement ? items.indexOf(event.target) : -1;
  const targets: Record<string, number> = {
    ArrowDown: (current + 1) % items.length,
    ArrowUp: (current - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  const target = targets[event.key];
  if (current === -1 || target === undefined) return;

  event.preventDefault();
  items[target]?.focus();
}

/** The navigation column beside the content, and the same items in a drawer on a compact screen. */
export function StudioWorkspaceNav({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'nav'>) {
  const { navId, navOpen, setNavOpen } = useStudioWorkspace('Nav');
  const { studioNavigation, menu } = useUiCopy();
  const styles = studioWorkspaceStyles();

  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      setNavOpen(false);
    }
  };

  return (
    <>
      <nav
        id={navId}
        data-slot="studio-workspace-nav"
        data-surface="rail"
        aria-label={studioNavigation}
        className={styles.nav({ className })}
        onKeyDown={moveFocus}
        {...props}
      >
        {children}
      </nav>
      <Drawer.Root open={navOpen} onOpenChange={setNavOpen}>
        <Drawer.Content aria-describedby={undefined}>
          <Drawer.Title className="tw:sr-only">{menu}</Drawer.Title>
          <Drawer.Body>
            <nav
              data-slot="studio-workspace-drawer-nav"
              data-surface="drawer"
              aria-label={studioNavigation}
              className={styles.drawerNav()}
              onClick={closeOnLink}
              onKeyDown={moveFocus}
            >
              {children}
            </nav>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

export interface StudioWorkspaceNavItemProps extends ComponentPropsWithRef<'a'> {
  icon: IconId;
  /** Marks the page the item leads to: `aria-current="page"` and the accent ground. */
  active?: boolean;
  /** Takes the router `Link` the caller passes and draws the icon and label on it. */
  asChild?: boolean;
}

/** One place to go: icon and label, the label in a tooltip while the column is collapsed. */
export function StudioWorkspaceNavItem({
  icon,
  active = false,
  asChild = false,
  className,
  children,
  ...props
}: StudioWorkspaceNavItemProps) {
  const { navCollapsed } = useStudioWorkspace('NavItem');
  const styles = studioWorkspaceStyles();
  const Element = asChild ? Slot.Root : 'a';
  const label =
    asChild && isValidElement<{ children?: ReactNode }>(children)
      ? children.props.children
      : children;

  const item = (
    <Element
      data-slot="studio-workspace-nav-item"
      aria-current={active ? 'page' : undefined}
      className={styles.navItem({ className })}
      {...props}
    >
      <Icon name={icon} size="md" className="tw:shrink-0" />
      <Slot.Slottable child={children}>
        {(text) => <span className={styles.navLabel()}>{text}</span>}
      </Slot.Slottable>
    </Element>
  );

  if (!navCollapsed) return item;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{item}</Tooltip.Trigger>
      <Tooltip.Content side="inline-end">{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}
