import { createFileRoute } from '@tanstack/react-router';
import { ensureFound } from '@vp/queries';
import { z } from 'zod';

import { liveOverlayQueryOptions } from '#app/features/live/api/live-queries';
import { LiveOverlayPage } from '#app/features/live/components/live-overlay-page';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Renders the page alone, with none of the studio around it. */
    bare?: boolean;
  }
}

export const Route = createFileRoute('/live/overlay/$token')({
  validateSearch: z.object({ widget: z.enum(['chat', 'alerts', 'goal']).catch('chat') }),
  staticData: { bare: true },
  loader: ({ context: { queryClient, api }, params: { token } }) =>
    ensureFound(queryClient, liveOverlayQueryOptions(api, token)),
  component: LiveOverlayPage,
});
