import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { HomePage, HomePageSkeleton } from '#app/features/browse';
import { LiveNowShelf } from '#app/features/live';
import { ShortsShelf } from '#app/features/shorts';
import { currentPickQueryOptions, homeQueryOptions } from '#app/lib/query-keys/home-keys';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await Promise.all([
      queryClient.ensureQueryData(homeQueryOptions(api)),
      queryClient.prefetchQuery(currentPickQueryOptions(api)),
    ]);
  },
  pendingComponent: HomePageSkeleton,
  component: Home,
});

const CLIENT_SHELVES = { shorts: <ShortsShelf />, liveNow: <LiveNowShelf /> };

function Home() {
  return <HomePage clientShelves={CLIENT_SHELVES} />;
}
