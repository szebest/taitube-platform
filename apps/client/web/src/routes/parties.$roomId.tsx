import { createFileRoute } from '@tanstack/react-router';
import { WatchPartyIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, watchPartyPreviewQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { PartyPage } from '#app/features/watch-party';
import { WEB_URL } from '#app/lib/config';
import { headWords } from '#app/lib/seo/head-words';
import { partyHead } from '#app/lib/seo/party-head';

export const Route = createFileRoute('/parties/$roomId')({
  params: {
    parse: ({ roomId }) => ({ roomId: parseParam(WatchPartyIdParamSchema.shape.id, roomId) }),
    stringify: ({ roomId }) => ({ roomId }),
  },
  validateSearch: z.object({ invite: z.string().max(128).optional() }),
  loaderDeps: ({ search: { invite } }) => ({ invite }),
  loader: ({ context: { queryClient, api }, params: { roomId }, deps: { invite } }) =>
    ensureFound(queryClient, watchPartyPreviewQueryOptions(api, roomId, invite)),
  head: ({ loaderData, match }) =>
    loaderData
      ? partyHead(loaderData, WEB_URL, headWords(match.context.locales.snapshot()))
      : { meta: [{ name: 'robots', content: 'noindex, nofollow' }] },
  component: PartyPage,
});
