import { Outlet, useMatches } from '@tanstack/react-router';
import { StudioShell } from '#app/features/shell';
import { ActingNavItems, ActiveChannelProvider } from '#app/features/team';
import { UploadDialog, UploadDockProvider, UploadWidget } from '#app/features/upload';
import { VideoInspector } from '#app/features/videos';
import { ActingUploadAction } from '../acting-upload-action/acting-upload-action';

/** Every page inside the studio's shell, on the acting channel and with the upload dock; a bare page has none of it. */
export function StudioRoot() {
  const bare = useMatches({
    select: (matches) => matches.some(({ staticData }) => staticData.bare),
  });

  if (bare) {
    return <Outlet />;
  }

  return (
    <ActiveChannelProvider>
      <UploadDockProvider>
        <StudioShell
          toolbarAction={<ActingUploadAction />}
          navigation={({ newComments }) => <ActingNavItems newComments={newComments} />}
          inspector={(videoId) => <VideoInspector videoId={videoId} />}
        />
        <UploadDialog />
        <UploadWidget />
      </UploadDockProvider>
    </ActiveChannelProvider>
  );
}
