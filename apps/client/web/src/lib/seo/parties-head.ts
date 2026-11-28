import type { HeadWords } from './head-words';
import { pageHead } from './page-head';

/** `/parties` is indexable, and every filtered variant names `/parties` as its canonical, so filters never become pages of their own. */
export function partiesHead(siteUrl: string, { locale, tOr }: HeadWords) {
  const title = tOr('party.discoveryHeadTitle', {}, '');
  const description = tOr('party.discoveryHeadDescription', {}, '');

  return pageHead({
    siteUrl,
    locale,
    path: '/parties',
    title,
    description,
    openGraphType: 'website',
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title },
    extraMeta: [{ name: 'robots', content: 'index, follow' }],
  });
}
