import { createFileRoute, redirect } from '@tanstack/react-router';
import { appLink } from '@vp/queries';
import { z } from 'zod';
import { STUDIO_URL } from '#app/lib/config';

export const Route = createFileRoute('/upload/')({
  validateSearch: z.object({}),
  beforeLoad: ({ context }) => {
    throw redirect({ href: appLink(STUDIO_URL, '/upload', context.identity.read()) });
  },
});
