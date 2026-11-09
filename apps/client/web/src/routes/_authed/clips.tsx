import { createFileRoute } from '@tanstack/react-router';
import { myClipsQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { ClipsShelf } from '#app/features/clips';

export const Route = createFileRoute('/_authed/clips')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.infiniteQuery({ ...myClipsQueryOptions(api), staleTime: 'static' }),
  component: ClipsShelf,
});
