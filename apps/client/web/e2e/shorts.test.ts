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
    await page.mouse.wheel(0, 500);

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

  test('has the full control set, each with a name', async ({ page }) => {
    await openShorts(page);
    const player = page.getByRole('region', { name: 'Shorts player' });

    for (const name of ['Unmute', 'Captions', /^Playback speed/, 'Like', 'Discussion', 'Share']) {
      await expect(player.getByRole('button', { name })).toBeVisible();
    }
    await expect(player.getByRole('slider', { name: 'Seek' })).toBeAttached();
    await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('takes focus when it opens, so the keys work from the first one', async ({ page }) => {
    await openShorts(page);

    await expect(page.getByRole('region', { name: 'Shorts player' })).toBeFocused();
  });

  test('snaps: a step puts the next Short exactly in view', async ({ page }) => {
    await openShorts(page);
    const feed = page.getByRole('region', { name: 'Shorts player' });

    await page.keyboard.press('ArrowDown');

    await expect
      .poll(() => feed.evaluate((element) => element.scrollTop % element.clientHeight))
      .toBe(0);
    await expect(page.getByRole('status')).toHaveText('Short 2, by Marta');
  });

  test('keeps the current Short in view across a resize and a rotation', async ({ page }) => {
    await openShorts(page);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('status')).toHaveText('Short 2, by Marta');

    for (const size of [
      { width: 375, height: 700 },
      { width: 700, height: 375 },
    ]) {
      await page.setViewportSize(size);
      await expect
        .poll(() =>
          page
            .getByRole('region', { name: 'Shorts player' })
            .evaluate((element) => element.scrollTop / element.clientHeight)
        )
        .toBe(1);
    }
  });

  test('builds a player for the Short on screen and its neighbours only, however far it goes', async ({
    page,
  }) => {
    await openShorts(page);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('status').filter({ hasText: 'Short 3, by Marta' })).toBeVisible();
    expect(await page.locator('video').count()).toBeLessThanOrEqual(3);
  });

  test('raises no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

    await openShorts(page);
    await page.keyboard.press('ArrowDown');

    expect(errors).toEqual([]);
  });
});
