import { switchAppearance } from '../../../../tests/playwright/appearance';
import { expect, test } from '../../../../tests/playwright/fixtures';

test('switches theme, mode and density from the shell without a reload', async ({ page }) => {
  await switchAppearance(page, '/no-such-page', { startsCompact: true });
  await expect(page).toHaveURL(/\/no-such-page$/);
});
