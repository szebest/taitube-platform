import type { WatchPartyPreviewView } from '@vp/api-contracts';
import type { HeadWords } from './head-words';
import { pageHead } from './page-head';

const NOINDEX = { name: 'robots', content: 'noindex, nofollow' };

/**
 * A party's page head. Rooms are ephemeral, so every page is `noindex`; a public or unlisted room
 * unfurls with its name, video and head count, a private one with the generic invitation and no
 * name or image.
 */
export function partyHead(
  room: Pick<WatchPartyPreviewView, 'id' | 'name' | 'visibility' | 'presentCount' | 'currentVideo'>,
  siteUrl: string,
  { locale, tOr }: HeadWords
) {
  const shared = room.visibility !== 'private';
  const title = shared
    ? tOr('party.roomTitle', { name: room.name }, '')
    : tOr('party.privateHeadTitle', {}, '');
  const description = shared
    ? tOr(
        'party.headDescription',
        { title: room.currentVideo?.title ?? '', count: room.presentCount },
        ''
      )
    : tOr('party.privateHeadDescription', {}, '');

  return pageHead({
    siteUrl,
    locale,
    path: `/parties/${room.id}`,
    title,
    description,
    image: (shared && room.currentVideo?.thumbnailUrl) || undefined,
    openGraphType: 'website',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title },
    extraMeta: [NOINDEX],
  });
}
