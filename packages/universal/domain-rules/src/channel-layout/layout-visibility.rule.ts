import type { LayoutAudience, LayoutVisibility, ViewerAudience } from '@vp/domain';

export interface LayoutViewer {
  readonly audience: ViewerAudience;
  readonly now: Date;
  /** The negotiated locale chain, most specific first. */
  readonly locales: readonly string[];
}

const AUDIENCES: Readonly<Record<LayoutAudience, readonly ViewerAudience[]>> = {
  everyone: ['guest', 'member', 'subscriber'],
  visitors: ['guest', 'member'],
  subscribers: ['subscriber'],
  signed_in: ['member', 'subscriber'],
};

export function isShownToAudience(
  { audience }: Pick<LayoutVisibility, 'audience'>,
  viewer: ViewerAudience
): boolean {
  return AUDIENCES[audience].includes(viewer);
}

export function isShownInLocale(
  { locales }: Pick<LayoutVisibility, 'locales'>,
  chain: readonly string[]
): boolean {
  return locales.length === 0 || chain.some((locale) => locales.includes(locale));
}

export function isShownInWindow(
  { from, to }: Pick<LayoutVisibility, 'from' | 'to'>,
  now: Date
): boolean {
  const instant = now.getTime();
  return (
    (from === null || Date.parse(from) <= instant) && (to === null || instant < Date.parse(to))
  );
}

/** Audience, locale and window together; the cache holds the first two, the window is judged at read. */
export function isShownTo(visibility: LayoutVisibility, viewer: LayoutViewer): boolean {
  return (
    isShownToAudience(visibility, viewer.audience) &&
    isShownInLocale(visibility, viewer.locales) &&
    isShownInWindow(visibility, viewer.now)
  );
}
