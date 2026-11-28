import { parseParam } from '@kit/query';
import { createFileRoute } from '@tanstack/react-router';
import { SHARE_TOKEN_PARAM, ShareTokenSchema } from '@vp/api-contracts';
import { PLAYLIST_ITEM_SORTS } from '@vp/domain';
import { z } from 'zod';
import {
  loadPlaylist,
  PlaylistLinkExpired,
  PlaylistPage,
  PlaylistPageSkeleton,
} from '#app/features/library';
import { urlModals } from '#app/lib/url-modal/registry';

const PlaylistIdSchema = z.uuid();

function Playlist() {
  const { kind } = Route.useLoaderData();

  return kind === 'expired' ? <PlaylistLinkExpired /> : <PlaylistPage />;
}

export const Route = createFileRoute('/playlist')({
  validateSearch: (search) =>
    z
      .object({
        list: z.string(),
        sort: z
          .unknown()
          .transform((value) => PLAYLIST_ITEM_SORTS.find((sort) => sort === value))
          .optional(),
        [SHARE_TOKEN_PARAM]: z
          .unknown()
          .transform((value) => ShareTokenSchema.safeParse(value).data)
          .optional(),
      })
      .and(urlModals.searchSchema)
      .parse(search),
  search: { middlewares: [urlModals.retainUrlModal] },
  loaderDeps: ({ search: { list, s } }) => ({ list, s }),
  loader: ({ context: { queryClient, api }, deps: { list, s } }) =>
    loadPlaylist(queryClient, api, parseParam(PlaylistIdSchema, list), s),
  pendingComponent: PlaylistPageSkeleton,
  component: Playlist,
});
