import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { useUploadDock } from '#app/features/upload';

export const Route = createFileRoute('/_authed/upload/')({
  validateSearch: z.object({}),
  component: UploadRoute,
});

function UploadRoute() {
  const { setDialogOpen } = useUploadDock('UploadRoute');

  useEffect(() => setDialogOpen(true), [setDialogOpen]);

  return <Navigate to="/videos" search={{}} replace />;
}
