import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { FALLBACK_LOCALE } from '@vp/intl';
import type { LocaleStore } from '@vp/intl-react';
import { isSupportedLocale, LOCALE_DETAILS, type SupportedLocale } from '@vp/messages';
import { tryCatch } from '@vp/result';

/** The search param a link, or a crawler following an `hreflang` alternate, names a locale with. */
export const LOCALE_PARAM = 'lang';

/** The supported locale a tag asks for: `pl-PL` is `pl`; a malformed or unserved tag is none. */
function matchSupportedLocale(tag: string | null | undefined): SupportedLocale | undefined {
  if (!tag) {
    return undefined;
  }
  const parsed = tryCatch(
    () => new Intl.Locale(tag),
    () => undefined
  );
  if (!parsed.ok) {
    return undefined;
  }
  return [parsed.value.baseName, parsed.value.language].find(isSupportedLocale);
}

/** The tags an `Accept-Language` header lists, most wanted first: `pl-PL,pl;q=0.9,en;q=0.8`. */
function acceptedLanguages(header: string | undefined): string[] {
  const ranges = (header ?? '').split(',').map((range) => {
    const [tag = '', ...parameters] = range.split(';').map((part) => part.trim());
    const quality = parameters.find((parameter) => parameter.startsWith('q='));
    return { tag, weight: quality === undefined ? 1 : Number(quality.slice('q='.length)) };
  });
  return ranges
    .filter(({ tag, weight }) => tag !== '' && tag !== '*' && weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ tag }) => tag);
}

interface LocaleCandidates {
  readonly requested?: string | null;
  /** The viewer's saved choice; `null` follows the browser. */
  readonly persisted?: string | null;
  /** `Accept-Language` during a server render, `navigator.languages` on a client-only navigation. */
  readonly accepted: readonly string[];
}

function firstSupported(tags: readonly (string | null | undefined)[]): SupportedLocale | undefined {
  return tags.map(matchSupportedLocale).find((locale) => locale !== undefined);
}

/** The first candidate a supported locale serves, most deliberate first, then `en`. */
function negotiateLocale({ requested, persisted, accepted }: LocaleCandidates): SupportedLocale {
  return firstSupported([requested, persisted, ...accepted]) ?? FALLBACK_LOCALE;
}

/** The browser's languages, most wanted first; a browser-only read, so a server render calls it never. */
export function readBrowserLanguages(): readonly string[] {
  return navigator.languages;
}

const viewerLanguages = createIsomorphicFn()
  .server((): readonly string[] => acceptedLanguages(getRequestHeader('accept-language')))
  .client(readBrowserLanguages);

export type RequestedLocale = Readonly<{
  locale: SupportedLocale;
  direction: 'ltr' | 'rtl';
  /** What the browser alone asks for, which the language setting offers beside the list. */
  browserLocale: SupportedLocale | undefined;
}>;

export type LocaleRequest = Readonly<{ searchStr: string; persisted?: string | null }>;

/**
 * The one place a page's locale is decided, in this order: the URL's `lang` param, the saved
 * preference, `Accept-Language` on the server or `navigator.languages` on a client-only
 * navigation, then `en`. A root route's `beforeLoad` calls it, so the result is in router context
 * and the hydration trusts what the server sent instead of negotiating again; the locale's
 * catalogue is loaded before it resolves.
 */
export async function requestLocale(
  locales: LocaleStore,
  { searchStr, persisted }: LocaleRequest
): Promise<RequestedLocale> {
  const accepted = viewerLanguages();
  const locale = negotiateLocale({
    requested: new URLSearchParams(searchStr).get(LOCALE_PARAM),
    persisted,
    accepted,
  });
  await locales.activate(locale);
  return {
    locale,
    direction: LOCALE_DETAILS[locale].direction,
    browserLocale: firstSupported(accepted),
  };
}
