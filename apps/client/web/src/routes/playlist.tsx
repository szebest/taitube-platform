import { createFileRoute } from '@tanstack/react-router';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';
import { PlaylistPage, PlaylistPageSkeleton } from '#app/features/library';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { urlModals } from '#app/lib/url-modal/registry';

const PlaylistIdSchema = z.uuid();

export const Route = createFileRoute('/playlist')({
  validateSearch: (search) =>
    z.object({ list: z.string() }).and(urlModals.searchSchema).parse(search),
  search: { middlewares: [urlModals.retainUrlModal] },
  loaderDeps: ({ search: { list } }) => ({ list }),
  loader: ({ context: { queryClient, api }, deps: { list } }) =>
    ensureFound(queryClient, playlistQueryOptions(api, parseParam(PlaylistIdSchema, list))),
  pendingComponent: PlaylistPageSkeleton,
  component: PlaylistPage,
});
