import { PageHeaderSkeleton } from '@vp/components';
import {
  Icon,
  IconButton,
  Progress,
  type ProgressProps,
  Skeleton,
  useMediaQuery,
  useUiCopy,
} from '@vp/ui';
import { type ComponentPropsWithRef, type ReactNode, useId, useState } from 'react';
import { StudioWorkspaceContext, useStudioWorkspace } from './studio-workspace.context';
import { studioWorkspaceStyles } from './studio-workspace.variants';
import type { InspectorSide, WorkspaceLayout } from './types';

const DOCKS_INSPECTOR = '(min-width: 1440px)';
const SHOWS_NAV = '(min-width: 600px)';

function useWorkspaceLayout(): WorkspaceLayout {
  const docksInspector = useMediaQuery(DOCKS_INSPECTOR);
  const showsNav = useMediaQuery(SHOWS_NAV);

  if (docksInspector) return 'three-column';
  return showsNav ? 'two-column' : 'single';
}

export interface StudioWorkspaceRootProps extends ComponentPropsWithRef<'div'> {
  inspectorOpen?: boolean;
  onInspectorOpenChange?: (open: boolean) => void;
  inspectorSide?: InspectorSide;
}

/**
 * The studio's frame: skip link, navigation, toolbar, content and inspector. The viewport picks the
 * layout; read it from `useStudioWorkspace().layout`.
 */
export function StudioWorkspaceRoot({
  inspectorOpen = false,
  onInspectorOpenChange,
  inspectorSide = 'inline-end',
  className,
  children,
  ...props
}: StudioWorkspaceRootProps) {
  const layout = useWorkspaceLayout();
  const navId = useId();
  const [navOpen, setNavOpen] = useState(false);
  const { skipToContent } = useUiCopy();
  const styles = studioWorkspaceStyles({ inspectorSide });
  const shared = {
    layout,
    navCollapsed: layout === 'two-column',
    navId,
    navOpen,
    setNavOpen,
    inspectorOpen,
    setInspectorOpen: (open: boolean) => onInspectorOpenChange?.(open),
    inspectorSide,
  };

  return (
    <StudioWorkspaceContext value={shared}>
      <div
        data-slot="studio-workspace"
        data-layout={layout}
        className={styles.root({ className })}
        {...props}
      >
        <a href="#main" data-slot="studio-workspace-skip-link" className={styles.skipLink()}>
          {skipToContent}
        </a>
        {children}
      </div>
    </StudioWorkspaceContext>
  );
}

/** The sticky bar above the content: page actions and filters, with the menu button on a compact screen. */
export function StudioWorkspaceToolbar({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'header'>) {
  const { navId, navOpen, setNavOpen, inspectorSide } = useStudioWorkspace('Toolbar');
  const { menu } = useUiCopy();
  const styles = studioWorkspaceStyles({ inspectorSide });

  return (
    <header
      data-slot="studio-workspace-toolbar"
      className={styles.toolbar({ className })}
      {...props}
    >
      <IconButton
        aria-label={menu}
        aria-controls={navId}
        aria-expanded={navOpen}
        className={styles.menu()}
        onClick={() => setNavOpen(true)}
      >
        <Icon name="menu" />
      </IconButton>
      <div role="toolbar" className={styles.toolbarItems()}>
        {children}
      </div>
    </header>
  );
}

/** The strip along the toolbar's lower edge while an upload runs; name it with `aria-label`. */
export function StudioWorkspaceProgress({ className, ...props }: ProgressProps) {
  useStudioWorkspace('Progress');

  return (
    <Progress
      data-slot="studio-workspace-progress"
      className={studioWorkspaceStyles().progress({ className })}
      {...props}
    />
  );
}

/** `main#main`, where the skip link lands. */
export function StudioWorkspaceContent({ className, ...props }: ComponentPropsWithRef<'main'>) {
  const { inspectorSide } = useStudioWorkspace('Content');

  return (
    <main
      id="main"
      tabIndex={-1}
      data-slot="studio-workspace-content"
      className={studioWorkspaceStyles({ inspectorSide }).content({ className })}
      {...props}
    />
  );
}

const SKELETON_ITEMS = ['dashboard', 'videos', 'analytics', 'comments', 'settings'];

/** The frame at its final size before the data lands: the page header, then the page's own skeleton. */
export function StudioWorkspaceSkeleton({ children }: { children?: ReactNode }) {
  const styles = studioWorkspaceStyles();

  return (
    <div data-slot="studio-workspace-skeleton" aria-hidden="true" className={styles.root()}>
      <div className={styles.nav()}>
        {SKELETON_ITEMS.map((item) => (
          <Skeleton key={item} radius="control" className="tw:h-touch-target tw:w-full" />
        ))}
      </div>
      <div className={styles.toolbar()}>
        <Skeleton radius="control" className="tw:h-control-md tw:w-full tw:max-w-[20rem]" />
      </div>
      <div className={styles.content()}>
        <PageHeaderSkeleton />
        {children}
      </div>
      <div className={styles.inspector({ className: 'tw:hidden tw:large:flex' })} />
    </div>
  );
}
