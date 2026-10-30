import { Navigate, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { useUploadDock } from '#app/features/upload/hooks/upload-dock';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authed/upload/')({
  validateSearch: z.object({}),
  component: UploadRoute,
});

function UploadRoute() {
  const { setDialogOpen } = useUploadDock('UploadRoute');

  useEffect(() => setDialogOpen(true), [setDialogOpen]);

  return <Navigate to="/videos" search={{}} replace />;
}
