import { expect, test } from '../../../../tests/playwright/fixtures';
import { idOf, openShorts } from './shorts-feed';

test.describe('sharing a Short', () => {
  test('the link is the Short, never a watch page', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openShorts(page);

    await page.getByRole('button', { name: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this short' });
    await expect(dialog.getByRole('textbox', { name: 'Link' })).toContainText(`/shorts/${idOf(1)}`);
    await dialog.getByRole('button', { name: 'Copy' }).click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      new RegExp(`/shorts/${idOf(1)}$`)
    );
  });

  test('is a drawer on a phone', async ({ page }) => {
    await openShorts(page);
    await page.setViewportSize({ width: 375, height: 800 });

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(page.getByRole('dialog', { name: 'Share this short' })).toHaveAttribute(
      'data-slot',
      'drawer-content'
    );
  });
});
