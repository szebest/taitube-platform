import type { LayoutAudience, LayoutVisibility, ViewerAudience } from '@vp/domain';

export interface LayoutViewer {
  readonly audience: ViewerAudience;
  readonly now: Date;
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
  if (locales.length === 0) return true;
  const [resolved = ''] = chain;
  const [language = resolved] = resolved.split('-');
  return locales.includes(resolved) || locales.includes(language);
}

function isShownInWindow({ from, to }: Pick<LayoutVisibility, 'from' | 'to'>, now: Date): boolean {
  const instant = now.getTime();
  return (
    (from === null || new Date(from).getTime() <= instant) &&
    (to === null || instant < new Date(to).getTime())
  );
}

export function isShownTo(visibility: LayoutVisibility, viewer: LayoutViewer): boolean {
  return (
    isShownToAudience(visibility, viewer.audience) &&
    isShownInLocale(visibility, viewer.locales) &&
    isShownInWindow(visibility, viewer.now)
  );
}
