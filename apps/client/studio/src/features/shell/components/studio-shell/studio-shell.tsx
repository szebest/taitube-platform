import { Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useLayoutMaxWidth, useUserEvent } from '@vp/queries';
import { Logo } from '@vp/ui';
import { type ReactNode, useState } from 'react';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { useAccessDeniedToast } from '#app/features/shell/hooks/use-access-denied-toast';
import { SelectedVideoContext } from '#app/hooks/use-selected-video';
import { WEB_URL } from '#app/lib/config';
import { ShellAccountMenu } from '../shell-account-menu/shell-account-menu';

export type StudioShellProps = {
  /** The toolbar's action beside the account menu. */
  toolbarAction: ReactNode;
  /** The navigation's pages ahead of the admin entry, told whether a comment arrived off the inbox. */
  navigation: (state: { newComments: boolean }) => ReactNode;
  /** What the inspector shows for the video the library selected. */
  inspector: (videoId: string) => ReactNode;
};

/** The studio around every page: the workspace's navigation and toolbar, the page in its content. */
export function StudioShell({ toolbarAction, navigation, inspector }: StudioShellProps) {
  const matchRoute = useMatchRoute();
  const maxWidth = useLayoutMaxWidth();
  const { tOr } = useT();
  const [videoId, setVideoId] = useState<string>();
  const [newComments, setNewComments] = useState(false);
  const onLibrary = Boolean(matchRoute({ to: '/videos' }));
  const onComments = Boolean(matchRoute({ to: '/comments' }));

  if (onComments && newComments) {
    setNewComments(false);
  }

  useUserEvent('comment.created', () => setNewComments(true));

  useAccessDeniedToast();

  return (
    <StudioWorkspace.Root
      inspectorOpen={onLibrary && videoId !== undefined}
      onInspectorOpenChange={(open) => {
        if (!open) {
          setVideoId(undefined);
        }
      }}
    >
      <StudioWorkspace.Nav>
        {navigation({ newComments })}
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
        <Link
          to="/videos"
          search={{}}
          className="flex items-center gap-inline text-fg no-underline"
        >
          <Logo className="[&>span]:hidden medium:[&>span]:block" />
          <span className="sr-only text-label medium:not-sr-only">
            {tOr('studio.title', {}, '')}
          </span>
        </Link>
        <div className="ms-auto flex items-center gap-inline">
          {toolbarAction}
          <ShellAccountMenu />
        </div>
      </StudioWorkspace.Toolbar>
      <SelectedVideoContext value={{ videoId, open: setVideoId }}>
        <StudioWorkspace.Content>
          <div className="mx-auto w-full" style={{ maxWidth }}>
            <Outlet />
          </div>
        </StudioWorkspace.Content>
      </SelectedVideoContext>
      {onLibrary && (
        <StudioWorkspace.Inspector title={tOr('studio.inspectorTitle', {}, '')}>
          {videoId !== undefined && inspector(videoId)}
        </StudioWorkspace.Inspector>
      )}
    </StudioWorkspace.Root>
  );
}
