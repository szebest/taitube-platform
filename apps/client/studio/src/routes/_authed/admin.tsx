import { createFileRoute, redirect } from '@tanstack/react-router';
import { canAccessAdmin } from '@vp/permissions';
import { viewerOf } from '@vp/queries';
import { z } from 'zod';

import { AdminLayout } from '#app/features/admin/components/admin-layout';

export const Route = createFileRoute('/_authed/admin')({
  validateSearch: z.object({}),
  beforeLoad: ({ context }) => {
    if (!canAccessAdmin({ user: viewerOf(context.auth) })) {
      throw redirect({ to: '/', search: { denied: 'admin' }, replace: true });
    }
  },
  component: AdminLayout,
});
