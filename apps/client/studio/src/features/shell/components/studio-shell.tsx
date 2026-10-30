import { Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useLayoutMaxWidth } from '@vp/queries';
import { Logo, ThemeMenu } from '@vp/ui';

import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { WEB_URL } from '#app/config';
import { useAccessDeniedToast } from '#app/features/shell/hooks/use-access-denied-toast';
import { ShellAccountMenu } from './shell-account-menu';

/** The studio around every page: the workspace's navigation and toolbar, the page in its content. */
export function StudioShell() {
  const matchRoute = useMatchRoute();
  const maxWidth = useLayoutMaxWidth();
  const { tOr } = useT();

  useAccessDeniedToast();

  return (
    <StudioWorkspace.Root>
      <StudioWorkspace.Nav>
        <StudioWorkspace.NavItem
          asChild
          icon="upload"
          active={Boolean(matchRoute({ to: '/upload', fuzzy: true }))}
        >
          <Link to="/upload">{tOr('studio.navUpload', {}, '')}</Link>
        </StudioWorkspace.NavItem>
        <Can type="rule" I={canAccessAdmin}>
          <StudioWorkspace.NavItem
            asChild
            icon="shield"
            active={Boolean(matchRoute({ to: '/admin', fuzzy: true }))}
          >
            <Link to="/admin">{tOr('studio.adminNav', {}, '')}</Link>
          </StudioWorkspace.NavItem>
        </Can>
        <StudioWorkspace.NavItem icon="home" href={WEB_URL}>
          {tOr('studio.backToWeb', {}, '')}
        </StudioWorkspace.NavItem>
      </StudioWorkspace.Nav>
      <StudioWorkspace.Toolbar>
        <Link to="/" className="tw:flex tw:items-center tw:gap-inline tw:text-fg tw:no-underline">
          <Logo />
          <span className="tw:text-label">{tOr('studio.title', {}, '')}</span>
        </Link>
        <div className="tw:ms-auto tw:flex tw:items-center tw:gap-inline">
          <ThemeMenu />
          <ShellAccountMenu />
        </div>
      </StudioWorkspace.Toolbar>
      <StudioWorkspace.Content>
        <div className="tw:mx-auto tw:w-full" style={{ maxWidth }}>
          <Outlet />
        </div>
      </StudioWorkspace.Content>
    </StudioWorkspace.Root>
  );
}
