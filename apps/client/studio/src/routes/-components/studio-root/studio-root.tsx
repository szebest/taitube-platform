import { Outlet, useMatches } from '@tanstack/react-router';
import { StudioShell } from '#app/features/shell';
import {
  UploadDialog,
  UploadDockProvider,
  UploadToolbarButton,
  UploadWidget,
} from '#app/features/upload';
import { VideoInspector } from '#app/features/videos';

/** Every page inside the studio's shell, with the upload dock; a bare page has none of it. */
export function StudioRoot() {
  const bare = useMatches({
    select: (matches) => matches.some(({ staticData }) => staticData.bare),
  });

  if (bare) {
    return <Outlet />;
  }

  return (
    <UploadDockProvider>
      <StudioShell
        toolbarAction={<UploadToolbarButton />}
        inspector={(videoId) => <VideoInspector videoId={videoId} />}
      />
      <UploadDialog />
      <UploadWidget />
    </UploadDockProvider>
  );
}
