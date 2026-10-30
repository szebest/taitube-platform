import { createFileRoute } from '@tanstack/react-router';
import { myClipsQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { ClipsShelf } from '#app/features/clips/components/clips-shelf';

export const Route = createFileRoute('/_authed/clips')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureInfiniteQueryData(myClipsQueryOptions(api)),
  component: ClipsShelf,
});
