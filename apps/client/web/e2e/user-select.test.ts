import type { Locator } from '@playwright/test';
import { expect, test } from '../../../../tests/playwright/fixtures';

const userSelect = (locator: Locator) =>
  locator.first().evaluate((element) => getComputedStyle(element).userSelect);

test.describe('selectable text', () => {
  test.beforeEach(async ({ page, signIn }) => {
    await signIn('viewer');
    await page.goto('/search?q=a', { waitUntil: 'networkidle' });
  });

  test.describe('chrome is not selected', () => {
    for (const [name, selector] of [
      ['the "/" hint', 'header kbd'],
      ['a sidebar item', 'nav a'],
      ['the account trigger', '[data-slot="account-menu-trigger"]'],
      ['a filter radio', '[role="radio"]'],
    ] as const) {
      test(name, async ({ page }) => {
        expect(await userSelect(page.locator(selector))).toBe('none');
      });
    }
  });

  test('a page title is selected', async ({ page }) => {
    expect(await userSelect(page.locator('main h1, main h2'))).not.toBe('none');
  });
});
