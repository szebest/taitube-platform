import axe from 'axe-core';

/**
 * The WCAG A and AA rules axe finds broken in the page body, by rule id. jsdom lays nothing out and
 * paints nothing, so colour contrast is checked against the theme tokens in `design-system.test.ts`.
 */
export async function axeViolations(): Promise<string[]> {
  const { violations } = await axe.run(document.body, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations.map(({ id }) => id);
}
