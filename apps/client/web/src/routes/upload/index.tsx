import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { STUDIO_URL } from '#app/config';

export const Route = createFileRoute('/upload/')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    throw redirect({ href: `${STUDIO_URL}/upload` });
  },
});
