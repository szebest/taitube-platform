import { SUPPORTED_LOCALES, type SupportedLocale } from '@vp/messages';
import { LOCALE_PARAM } from '@vp/queries';

import { serializeJsonLd } from './json-ld';

const DESCRIPTION_LIMIT = 200;
const SITE_NAME = 'Taitube';

type HeadLink = { rel: string; href: string; type?: string; title?: string; hrefLang?: string };

type PageHeadOptions = {
  siteUrl: string;
  /** The negotiated locale the page renders in. */
  locale: SupportedLocale;
  path: string;
  title: string;
  description: string;
  image?: string;
  openGraphType: string;
  twitterCard?: 'summary' | 'player';
  jsonLd: Record<string, unknown>;
  extraMeta?: Array<{ property?: string; name?: string; content: string }>;
  extraLinks?: HeadLink[];
};

function excerpt(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length > DESCRIPTION_LIMIT ? `${flat.slice(0, DESCRIPTION_LIMIT - 1)}…` : flat;
}

/** OpenGraph names a locale `language_TERRITORY`: `pl` is `pl_PL`. */
function openGraphLocale(locale: SupportedLocale): string {
  const { language, region } = new Intl.Locale(locale).maximize();
  return region === undefined ? language : `${language}_${region}`;
}

/** The same page in every supported language, through the `lang` param, and the negotiated one by default. */
function languageAlternates(url: string): HeadLink[] {
  return [
    ...SUPPORTED_LOCALES.map((tag) => ({
      rel: 'alternate',
      hrefLang: tag,
      href: `${url}?${new URLSearchParams({ [LOCALE_PARAM]: tag })}`,
    })),
    { rel: 'alternate', hrefLang: 'x-default', href: url },
  ];
}

/**
 * The head every public page shares: title, description, canonical, the `hreflang` alternates,
 * OpenGraph in the negotiated locale, Twitter and the JSON-LD block.
 */
export function pageHead({
  siteUrl,
  locale,
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
      { property: 'og:locale', content: openGraphLocale(locale) },
      ...SUPPORTED_LOCALES.filter((other) => other !== locale).map((other) => ({
        property: 'og:locale:alternate',
        content: openGraphLocale(other),
      })),
      { property: 'og:title', content: title },
      { property: 'og:description', content: summary },
      ...(image ? [{ property: 'og:image', content: image }] : []),
      { name: 'twitter:card', content: twitterCard },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: summary },
      ...(image ? [{ name: 'twitter:image', content: image }] : []),
      ...extraMeta,
    ],
    links: [{ rel: 'canonical', href: url }, ...languageAlternates(url), ...extraLinks],
    scripts: [{ type: 'application/ld+json', children: serializeJsonLd(jsonLd) }],
  };
}
