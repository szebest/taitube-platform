import { expect, test } from '../../../../tests/playwright/fixtures';
import { idOf, openShorts } from './shorts-feed';

test.describe('shorts', () => {
  test('arrow keys swipe through the Shorts, name each in the URL and announce it', async ({
    page,
  }) => {
    await openShorts(page);
    await page.getByRole('region', { name: 'Shorts player' }).focus();

    await page.keyboard.press('ArrowDown');

    await expect(page).toHaveURL(`/shorts/${idOf(2)}`);
    await expect(page.getByRole('status')).toHaveText('Short 2, by Marta');

    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(`/shorts/${idOf(3)}`);
    await page.keyboard.press('ArrowUp');
    await expect(page).toHaveURL(`/shorts/${idOf(2)}`);
  });

  test('the wheel moves one Short per flick', async ({ page }) => {
    await openShorts(page);

    await page.getByRole('region', { name: 'Shorts player' }).hover();
    await page.mouse.wheel(0, 120);

    await expect(page).toHaveURL(`/shorts/${idOf(2)}`);
  });

  test('M unmutes the Short that started muted', async ({ page }) => {
    await openShorts(page);
    await page.getByRole('region', { name: 'Shorts player' }).focus();

    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
    await page.keyboard.press('m');

    await expect(page.getByRole('button', { name: 'Unmute' })).toBeHidden();
  });

  test('moving between Shorts leaves no history behind, so Back leaves the player', async ({
    page,
  }) => {
    await openShorts(page);
    await page.getByRole('region', { name: 'Shorts player' }).focus();

    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(`/shorts/${idOf(2)}`);
    await page.goBack();

    await expect(page).toHaveURL('/');
  });
});
