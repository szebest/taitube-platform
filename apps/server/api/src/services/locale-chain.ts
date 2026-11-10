import { FALLBACK_LOCALE, localeChain } from '@vp/intl';
import { isOk } from '@vp/result';

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
    const parsed = localeChain(tag);
    if (isOk(parsed)) chain.push(...parsed.value.filter((entry) => entry !== FALLBACK_LOCALE));
  }
  return [...new Set([...chain, FALLBACK_LOCALE])];
}
