const FALLBACK_LOCALE = 'en';

function tagsOf(acceptLanguage: string | undefined): string[] {
  return (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      return { tag: tag.trim(), q: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter(({ tag, q }) => tag !== '' && tag !== '*' && q > 0)
    .sort((a, b) => b.q - a.q)
    .map(({ tag }) => tag);
}

/**
 * Most preferred first, each tag followed by its language, ending at the fallback: the explicit
 * `locale` outranks `Accept-Language`, and a tag that is not a locale is skipped.
 */
export function localeChainOf(explicit: string | undefined, acceptLanguage?: string): string[] {
  const chain: string[] = [];
  for (const tag of [...(explicit ? [explicit] : []), ...tagsOf(acceptLanguage)]) {
    const parsed = safeLocale(tag);
    if (parsed) chain.push(parsed.baseName, parsed.language);
  }
  return [...new Set([...chain, FALLBACK_LOCALE])];
}

function safeLocale(tag: string): Intl.Locale | null {
  try {
    return new Intl.Locale(tag);
  } catch {
    return null;
  }
}
