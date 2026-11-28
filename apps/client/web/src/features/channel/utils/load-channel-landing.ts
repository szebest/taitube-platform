import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { accountOf, ensureFound, type Session } from '@vp/queries';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import {
  type ChannelPageArgs,
  channelPageQueryOptions,
  pageSeedOf,
  rememberPageSeed,
} from '#app/lib/query-keys/channel-page-keys';
import { canPreviewDraft } from './can-preview-draft';
import type { ChannelPageSearch } from './channel-page-search';

export interface ChannelLandingContext {
  queryClient: QueryClient;
  api: ApiClient;
  locale: string;
  auth: Session;
}

const MOVED_PERMANENTLY = 301;

/**
 * What both channel page routes load: the channel, sent on with a `301` to its current handle when
 * the address named a retired one, then the tab the address names (the viewer's landing tab without
 * one) resolved for this viewer, or, for a session that may edit the page, the draft as the
 * previewed audience would see it. A tab that is hidden, unknown or empty answers 404.
 */
export async function loadChannelLanding(
  context: ChannelLandingContext,
  idOrHandle: string,
  slug: string | undefined,
  { preview, as }: ChannelPageSearch
) {
  const { queryClient, api, locale, auth } = context;
  const channel = await ensureFound(queryClient, channelQueryOptions(api, idOrHandle));
  if (channel.redirectedFrom !== null) {
    throw slug === undefined
      ? redirect({
          to: '/channels/$handle',
          params: { handle: channel.handle },
          search: { preview, as },
          statusCode: MOVED_PERMANENTLY,
        })
      : redirect({
          to: '/channels/$handle/$slug',
          params: { handle: channel.handle, slug },
          search: { preview, as },
          statusCode: MOVED_PERMANENTLY,
        });
  }
  queryClient.setQueryData(channelQueryOptions(api, channel.id).queryKey, channel);

  const previewing = preview === 'draft' && (await canPreviewDraft(context, channel));
  const args: ChannelPageArgs = {
    channelId: channel.id,
    slug,
    locale,
    viewerId: accountOf(auth)?.id ?? null,
    preview: previewing ? (as ?? 'visitor') : null,
  };
  const page = await ensureFound(
    queryClient,
    channelPageQueryOptions(api, args, pageSeedOf(queryClient, channel.id))
  );
  rememberPageSeed(queryClient, channel.id, page.seed);

  return { channel, args, previewing: args.preview !== null };
}
