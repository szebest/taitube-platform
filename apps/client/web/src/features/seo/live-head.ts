import type { LiveStreamPublicView } from '@vp/api-contracts';
import type { HeadWords } from './head-words';
import { pageHead } from './page-head';

/** A broadcast's page: a `VideoObject` published as a `BroadcastEvent`, live until it ends. */
export function liveHead(
  stream: LiveStreamPublicView,
  siteUrl: string,
  { locale, tOr }: HeadWords
) {
  const name = stream.title || tOr('live.title', {}, '');
  const description =
    stream.description || tOr('live.headDescription', { name: stream.channel.displayName }, '');

  return pageHead({
    siteUrl,
    locale,
    path: `/live/${stream.id}`,
    title: name,
    description,
    image: stream.channel.avatarUrl ?? undefined,
    openGraphType: 'video.other',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      description,
      ...(stream.startedAt ? { uploadDate: stream.startedAt } : {}),
      publication: {
        '@type': 'BroadcastEvent',
        isLiveBroadcast: true,
        ...(stream.startedAt ? { startDate: stream.startedAt } : {}),
        ...(stream.endedAt ? { endDate: stream.endedAt } : {}),
      },
    },
  });
}
