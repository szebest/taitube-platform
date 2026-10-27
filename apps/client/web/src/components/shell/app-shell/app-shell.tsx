import { Drawer, Skeleton, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';
import { AppShellContext, RailLabelsShown, useAppShell } from './app-shell.context';
import { appShellStyles } from './app-shell.variants';
import type { AppShellRailState, AppShellVariant } from './types';
import { useRailOverlay } from './use-rail-overlay';

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

export interface AppShellRootProps extends ComponentPropsWithRef<'div'> {
  variant?: AppShellVariant;
  railState: AppShellRailState;
  onRailStateChange: (next: AppShellRailState) => void;
}

/** The frame around every page: skip link, header, rail, main, now playing and the compact tab bar, as the grid they sit in. */
export function AppShellRoot({
  variant = 'default',
  railState,
  onRailStateChange,
  className,
  children,
  ...props
}: AppShellRootProps) {
  const railId = useId();
  const drawerId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOverlay, setRailOverlay] = useState(false);
  const { skipToContent } = useUiCopy();
  const styles = appShellStyles({ variant });

  return (
    <AppShellContext
      value={{
        variant,
        railState,
        setRailState: onRailStateChange,
        railId,
        drawerId,
        drawerOpen,
        setDrawerOpen,
        railOverlay,
        setRailOverlay,
      }}
    >
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
/**
 * The rail beside the content, opening in place on large screens and over the content between expanded and
 * large; the same items in a drawer below that.
 */
export function AppShellRail({ className, children, ...props }: ComponentPropsWithRef<'nav'>) {
  const { railState, railId, drawerId, drawerOpen, setDrawerOpen, setRailOverlay } =
    useAppShell('Rail');
  const { navigation, menu } = useUiCopy();
  const navRef = useRef<HTMLElement>(null);
  const { overlay, opensInPlace } = useRailOverlay(navRef);
  const styles = appShellStyles({ railState, overlay });

  const closeOnLink = (close: (open: boolean) => void) => (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      close(false);
    }
  };

  return (
    <>
      <RailLabelsShown value={overlay || (opensInPlace && railState === 'open')}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: a link inside answers the keyboard itself; this only closes the overlay after it */}
        <nav
          ref={navRef}
          id={railId}
          data-slot="app-shell-rail"
          data-surface="rail"
          data-state={railState}
          data-labels={overlay ? 'shown' : undefined}
          aria-label={navigation}
          className={styles.rail({ className })}
          onClick={closeOnLink(setRailOverlay)}
          {...props}
        >
          {children}
        </nav>
      </RailLabelsShown>
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content id={drawerId} aria-describedby={undefined}>
          <Drawer.Title className="tw:sr-only">{menu}</Drawer.Title>
          <Drawer.Body>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: a link inside answers the keyboard itself; this only closes the drawer after it */}
            <nav
              data-slot="app-shell-drawer"
              data-surface="drawer"
              data-state="open"
              data-labels="shown"
              aria-label={navigation}
              className={styles.drawerNav()}
              onClick={closeOnLink(setDrawerOpen)}
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

/** The slot at the foot of the content column for the now playing bar; it takes no room while empty. */
export function AppShellNowPlaying({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = appShellStyles();

  return (
    <div
      data-slot="app-shell-now-playing"
      className={styles.nowPlaying({ className })}
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
