import { Link, Outlet, useMatches, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canAccessAdmin, canUpdateVideo } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount, useLayoutMaxWidth, useUserEvent } from '@vp/queries';
import { Button, Logo } from '@vp/ui';
import { useState } from 'react';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { SelectedVideoContext } from '#app/features/shell/hooks/selected-video';
import { useAccessDeniedToast } from '#app/features/shell/hooks/use-access-denied-toast';
import { ActingNavItems, ActiveChannelProvider, useActiveChannel } from '#app/features/team';
import { UploadDialog } from '#app/features/upload/components/upload-dialog/upload-dialog';
import {
  UploadDockProvider,
  useUploadDock,
} from '#app/features/upload/components/upload-dock/upload-dock';
import { UploadWidget } from '#app/features/upload/components/upload-widget/upload-widget';
import { VideoInspector } from '#app/features/videos/components/video-inspector/video-inspector';
import { WEB_URL } from '#app/lib/config';
import { ShellAccountMenu } from '../shell-account-menu/shell-account-menu';

function UploadToolbarButton() {
  const { setDialogOpen } = useUploadDock('ToolbarButton');
  const { tOr } = useT();
  const { ownerId } = useActiveChannel();

  return (
    <Can type="rule" I={canUpdateVideo} this={{ video: { ownerId } }}>
      <Button size="sm" variant="solid" tone="accent" onClick={() => setDialogOpen(true)}>
        {tOr('studio.navUpload', {}, '')}
      </Button>
    </Can>
  );
}

function StudioFrame() {
  const matchRoute = useMatchRoute();
  const signedIn = Boolean(useAccount());
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
        <ActingNavItems newComments={newComments} />
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
          <Logo />
          <span className="text-label">{tOr('studio.title', {}, '')}</span>
        </Link>
        <div className="ms-auto flex items-center gap-inline">
          {signedIn && <UploadToolbarButton />}
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
          {videoId !== undefined && <VideoInspector videoId={videoId} />}
        </StudioWorkspace.Inspector>
      )}
    </StudioWorkspace.Root>
  );
}

/** The studio around every page: the workspace's navigation and toolbar, the page in its content. A bare page has none of it. */
export function StudioShell() {
  const bare = useMatches({
    select: (matches) => matches.some(({ staticData }) => staticData.bare),
  });

  if (bare) {
    return <Outlet />;
  }

  return (
    <ActiveChannelProvider>
      <UploadDockProvider>
        <StudioFrame />
        <UploadDialog />
        <UploadWidget />
      </UploadDockProvider>
    </ActiveChannelProvider>
  );
}
