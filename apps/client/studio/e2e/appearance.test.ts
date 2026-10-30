import { expect, test } from '../../../../tests/playwright/fixtures';
import { switchAppearance } from '../../../../tests/playwright/appearance';

test('switches theme, mode and density from the shell without a reload', async ({ page }) => {
  await switchAppearance(page, '/no-such-page', { startsCompact: true });
  await expect(page).toHaveURL(/\/no-such-page$/);
});
