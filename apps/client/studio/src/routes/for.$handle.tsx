import { createFileRoute, redirect } from '@tanstack/react-router';
import { parseParam, studioPathForChannel } from '@vp/queries';
import { z } from 'zod';

/**
 * Opens the studio for one channel as the identity that acts on it in this browser (the one last
 * used for it, else the first account that owns it or works on its team), then goes on to `next`;
 * a channel no account here acts as lands on the studio's home.
 */
export const Route = createFileRoute('/for/$handle')({
  params: {
    parse: ({ handle }) => ({ handle: parseParam(z.string().min(1).max(30), handle) }),
    stringify: ({ handle }) => ({ handle }),
  },
  validateSearch: z.object({ next: z.string().startsWith('/').optional() }),
  beforeLoad: async ({ params, search }) => {
    const path = await studioPathForChannel({
      data: { handle: params.handle, next: search.next ?? '/' },
    });
    throw redirect({ href: path ?? '/', replace: true });
  },
});
