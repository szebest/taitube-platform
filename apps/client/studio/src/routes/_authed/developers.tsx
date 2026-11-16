import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import {
  apiTokensQueryOptions,
  DevelopersPage,
  webhooksQueryOptions,
} from '#app/features/developers';

export const Route = createFileRoute('/_authed/developers')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    prefetched(
      Promise.all([
        queryClient.query(apiTokensQueryOptions(api)),
        queryClient.query(webhooksQueryOptions(api)),
      ])
    ),
  component: DevelopersPage,
});
