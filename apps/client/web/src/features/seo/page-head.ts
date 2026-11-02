import { serializeJsonLd } from './json-ld';

const DESCRIPTION_LIMIT = 200;
const SITE_NAME = 'Taitube';

type PageHeadOptions = {
  siteUrl: string;
  path: string;
  title: string;
  description: string;
  image?: string;
  openGraphType: string;
  twitterCard?: 'summary' | 'player';
  jsonLd: Record<string, unknown>;
  extraMeta?: Array<{ property?: string; name?: string; content: string }>;
  extraLinks?: Array<{ rel: string; href: string; type?: string; title?: string }>;
};

function excerpt(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length > DESCRIPTION_LIMIT ? `${flat.slice(0, DESCRIPTION_LIMIT - 1)}…` : flat;
}

/** The head every public page shares: title, description, canonical, OpenGraph, Twitter and the JSON-LD block. */
export function pageHead({
  siteUrl,
  path,
  title,
  description,
  image,
  openGraphType,
  twitterCard = 'summary',
  jsonLd,
  extraMeta = [],
  extraLinks = [],
}: PageHeadOptions) {
  const url = `${siteUrl}${path}`;
  const summary = excerpt(description);

  return {
    meta: [
      { title },
      { name: 'description', content: summary },
      { property: 'og:type', content: openGraphType },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:url', content: url },
      { property: 'og:title', content: title },
      { property: 'og:description', content: summary },
      ...(image ? [{ property: 'og:image', content: image }] : []),
      { name: 'twitter:card', content: twitterCard },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: summary },
      ...(image ? [{ name: 'twitter:image', content: image }] : []),
      ...extraMeta,
    ],
    links: [{ rel: 'canonical', href: url }, ...extraLinks],
    scripts: [{ type: 'application/ld+json', children: serializeJsonLd(jsonLd) }],
  };
}
