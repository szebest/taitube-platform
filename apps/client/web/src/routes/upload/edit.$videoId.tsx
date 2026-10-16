import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { STUDIO_URL } from '#app/config';

export const Route = createFileRoute('/upload/edit/$videoId')({
  validateSearch: z.object({}),
  beforeLoad: ({ params: { videoId } }) => {
    throw redirect({ href: `${STUDIO_URL}/upload/edit/${videoId}` });
  },
});
