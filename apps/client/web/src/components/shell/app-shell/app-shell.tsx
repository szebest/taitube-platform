import { Drawer, Icon, IconButton, type IconId, Skeleton, useMediaQuery, useUiCopy } from '@vp/ui';
import { Slot } from 'radix-ui';
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from 'react';
import { AppShellContext, useAppShell } from './app-shell.context';
import { appShellStyles } from './app-shell.variants';
import type { AppShellRailState, AppShellVariant } from './types';

const SKELETON_ROWS = [
  'home',
  'explore',
  'shorts',
  'following',
  'you',
  'history',
  'playlists',
  'videos',
];

const RAIL_OPENS_IN_PLACE = '(min-width: 1440px)';

export interface AppShellRootProps extends ComponentPropsWithRef<'div'> {
  variant?: AppShellVariant;
  railState: AppShellRailState;
  onRailStateChange: (next: AppShellRailState) => void;
}

/** The frame around every page: skip link, header, rail, main and the compact tab bar, as the grid they sit in. */
export function AppShellRoot({
  variant = 'default',
  railState,
  onRailStateChange,
  className,
  children,
  ...props
}: AppShellRootProps) {
  const railId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { skipToContent } = useUiCopy();
  const shared = useMemo(
    () => ({
      variant,
      railState,
      setRailState: onRailStateChange,
      railId,
      drawerOpen,
      setDrawerOpen,
    }),
    [variant, railState, onRailStateChange, railId, drawerOpen]
  );
  const styles = appShellStyles({ variant });

  return (
    <AppShellContext value={shared}>
      <div
        data-slot="app-shell"
        data-variant={variant}
        className={styles.root({ className })}
        {...props}
      >
        <a href="#main" data-slot="app-shell-skip-link" className={styles.skipLink()}>
          {skipToContent}
        </a>
        {children}
      </div>
    </AppShellContext>
  );
}

export interface AppShellHeaderProps extends Omit<ComponentPropsWithRef<'header'>, 'children'> {
  logo: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
  account?: ReactNode;
}

/** The menu button, the mark, the search, then the actions and the account at the end. */
export function AppShellHeader({
  logo,
  search,
  actions,
  account,
  className,
  ...props
}: AppShellHeaderProps) {
  const { railState, setRailState, railId, drawerOpen, setDrawerOpen } = useAppShell('Header');
  const { menu } = useUiCopy();
  const railOpensInPlace = useMediaQuery(RAIL_OPENS_IN_PLACE);
  const styles = appShellStyles();

  const handleMenu = () => {
    if (railOpensInPlace) {
      setRailState(railState === 'open' ? 'collapsed' : 'open');
      return;
    }
    setDrawerOpen(true);
  };

  return (
    <header data-slot="app-shell-header" className={styles.header({ className })} {...props}>
      <div className={styles.headerStart()}>
        <IconButton
          aria-label={menu}
          aria-controls={railId}
          aria-expanded={railOpensInPlace ? railState === 'open' : drawerOpen}
          onClick={handleMenu}
        >
          <Icon name="menu" />
        </IconButton>
        {logo}
      </div>
      <div className={styles.headerSearch()}>{search}</div>
      <div className={styles.headerEnd()}>
        {actions}
        {account}
      </div>
    </header>
  );
}

/** The rail beside the content, and the same items in a drawer below the width it fits. */
export function AppShellRail({ className, children, ...props }: ComponentPropsWithRef<'nav'>) {
  const { railState, railId, drawerOpen, setDrawerOpen } = useAppShell('Rail');
  const { navigation, menu } = useUiCopy();
  const styles = appShellStyles({ railState });

  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      setDrawerOpen(false);
    }
  };

  return (
    <>
      <nav
        id={railId}
        data-slot="app-shell-rail"
        data-surface="rail"
        data-state={railState}
        aria-label={navigation}
        className={styles.rail({ className })}
        {...props}
      >
        {children}
      </nav>
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content aria-describedby={undefined}>
          <Drawer.Title className="tw:sr-only">{menu}</Drawer.Title>
          <Drawer.Body>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: a link inside answers the keyboard itself; this only closes the drawer after it */}
            <nav
              data-slot="app-shell-drawer"
              data-surface="drawer"
              data-state="open"
              aria-label={navigation}
              className={styles.drawerNav()}
              onClick={closeOnLink}
            >
              {children}
            </nav>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

export interface AppShellGroupProps extends ComponentPropsWithRef<'div'> {
  heading?: ReactNode;
}

/** A list of items, with a divider and a heading above it where the rail has room for them. */
export function AppShellGroup({ heading, className, children, ...props }: AppShellGroupProps) {
  const styles = appShellStyles();

  return (
    <div data-slot="app-shell-group" className={styles.group({ className })} {...props}>
      {heading !== undefined && (
        <>
          <hr className={styles.groupDivider()} />
          <h2 className={styles.groupHeading()}>{heading}</h2>
        </>
      )}
      <ul className={styles.list()}>{children}</ul>
    </div>
  );
}

export interface AppShellItemProps extends ComponentPropsWithRef<'a'> {
  icon: IconId;
  /** Marks the page the item leads to: `aria-current="page"` and the accent ground. */
  active?: boolean;
  /** Takes the link the caller passes, a router `Link`, and draws the item's icon and ground on it. */
  asChild?: boolean;
}

function NavLinkContent({
  icon,
  active,
  asChild,
  className,
  children,
  ...props
}: AppShellItemProps & { className: string | undefined }) {
  const Element = asChild ? Slot.Root : 'a';

  return (
    <Element aria-current={active ? 'page' : undefined} className={className} {...props}>
      <Icon name={icon} size="md" className="tw:shrink-0" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}

export interface AppShellRailItemProps extends AppShellItemProps {
  /** Only where the rail shows labels: the open rail and the drawer. */
  labelled?: boolean;
}

export function AppShellItem({ labelled = false, className, ...props }: AppShellRailItemProps) {
  const styles = appShellStyles({ labelled });

  return (
    <li data-slot="app-shell-item" className={styles.item()}>
      <NavLinkContent className={styles.link({ className })} {...props} />
    </li>
  );
}

/** The compact bottom bar: the few places to go from anywhere. */
export function AppShellTabBar({ className, children, ...props }: ComponentPropsWithRef<'nav'>) {
  const { navigation } = useUiCopy();
  const styles = appShellStyles();

  return (
    <nav
      data-slot="app-shell-tab-bar"
      aria-label={navigation}
      className={styles.tabBar({ className })}
      {...props}
    >
      <ul className={styles.list({ className: 'tw:flex-1 tw:flex-row' })}>{children}</ul>
    </nav>
  );
}

export function AppShellTabItem({ className, ...props }: AppShellItemProps) {
  const styles = appShellStyles();

  return (
    <li data-slot="app-shell-tab-item" className={styles.item()}>
      <NavLinkContent className={styles.tabLink({ className })} {...props} />
    </li>
  );
}

/** `main#main`, where the skip link lands. */
export function AppShellMain({ className, ...props }: ComponentPropsWithRef<'main'>) {
  const { variant } = useAppShell('Main');
  const styles = appShellStyles({ variant });

  return (
    <main
      id="main"
      tabIndex={-1}
      data-slot="app-shell-main"
      className={styles.main({ className })}
      {...props}
    />
  );
}

export function AppShellSkeleton({ railState = 'open' }: { railState?: AppShellRailState }) {
  const styles = appShellStyles({ railState });

  return (
    <div data-slot="app-shell-skeleton" aria-hidden="true" className={styles.root()}>
      <div className={styles.header()}>
        <Skeleton shape="circle" className="tw:size-control-md" />
        <Skeleton radius="xs" className="tw:h-[1.75rem] tw:w-[7.5rem]" />
        <div className={styles.headerSearch()}>
          <Skeleton radius="control" className="tw:h-control-md tw:w-full tw:max-w-[40rem]" />
        </div>
      </div>
      <div className={styles.rail()}>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} radius="control" className="tw:h-control-md tw:w-full" />
        ))}
      </div>
    </div>
  );
}
