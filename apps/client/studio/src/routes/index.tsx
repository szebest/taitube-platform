import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    throw redirect({ to: '/upload', replace: true });
  },
});
