import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/_authed/admin/')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    throw redirect({ to: '/admin/categories', replace: true });
  },
});
