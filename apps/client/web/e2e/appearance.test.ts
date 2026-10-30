import { expect, test } from '../../../../tests/playwright/fixtures';
import { switchAppearance } from '../../../../tests/playwright/appearance';

test('switches theme, mode and density from the header without a reload', async ({ page }) => {
  await switchAppearance(page, '/search', { startsCompact: false });
  await expect(page).toHaveURL(/\/search$/);
});
