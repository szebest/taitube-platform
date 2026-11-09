import { createFileRoute } from '@tanstack/react-router';
import { clipQueryOptions, ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';
import { WatchPending } from '#app/features/watch';
import { ClipPage } from './-components/clip-page/clip-page';

export const Route = createFileRoute('/clip/$clipId')({
  params: {
    parse: ({ clipId }) => ({ clipId: parseParam(z.uuid(), clipId) }),
    stringify: ({ clipId }) => ({ clipId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api }, params: { clipId } }) =>
    ensureFound(queryClient, clipQueryOptions(api, clipId)),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? 'Taitube' }] }),
  pendingComponent: WatchPending,
  component: ClipPage,
});
