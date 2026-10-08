import axe from 'axe-core';

import type { Theme } from '#app/components/ui/theme/theme-preference';

export const THEMES: readonly Theme[] = ['dark', 'light'];

/**
 * The WCAG A and AA rules axe finds broken in the page body under `theme`, by rule id. jsdom lays
 * nothing out and paints nothing, so colour contrast is left to a real browser.
 */
export async function axeViolations(theme: Theme): Promise<string[]> {
  document.documentElement.dataset.theme = theme;
  const { violations } = await axe.run(document.body, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations.map(({ id }) => id);
}
