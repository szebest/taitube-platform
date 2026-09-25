import { FALLBACK_LOCALE, localeChain } from '@vp/intl';

export interface LocaleCandidates {
  readonly explicit?: string;
  readonly persisted?: string;
  readonly languages: readonly string[];
}

function isUsable(candidate: string | undefined): candidate is string {
  return candidate !== undefined && candidate !== '' && localeChain(candidate).ok;
}

/**
 * The locale a page renders in, most deliberate choice first: the prop a server render hands in,
 * then the viewer's saved preference, then the browser's languages, then the fallback. A malformed
 * candidate is skipped rather than trusted.
 */
export function resolveLocale({ explicit, persisted, languages }: LocaleCandidates): string {
  const candidates = [explicit, persisted, ...languages];
  return candidates.find(isUsable) ?? FALLBACK_LOCALE;
}
