import { expect, type Page, test } from '../../../../tests/playwright/fixtures';

const CORRECTION = { startMs: 9_000, endMs: 13_000, text: 'The price is 5 dollars, not 4' };

const seekTo = async (page: Page, seconds: number) => {
  const seekBar = page.getByRole('slider', { name: 'Seek' });
  await expect.poll(async () => Number(await seekBar.getAttribute('max'))).toBeGreaterThan(14);
  await seekBar.fill(String(seconds));
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThanOrEqual(seconds - 0.5);
};

test.describe('player cards', () => {
  test('a correction shows only inside its range, clear of the controls, goes with Escape and is listed under the description', async ({
    page,
    api,
    stack,
  }) => {
    const creator = await api('creator');
    const videoId = stack.videos.clippable.id;
    const created = await creator.post(`/v1/videos/${videoId}/corrections`, { data: CORRECTION });
    const { id } = await created.json();

    try {
      await page.goto(`/watch/${videoId}`);
      const card = page.getByRole('note').filter({ hasText: CORRECTION.text });
      await expect(page.getByRole('slider', { name: 'Seek' })).toBeAttached();
      await expect(card).toHaveCount(0);

      await seekTo(page, 10);
      await expect(card).toBeVisible();
      await page.locator('[data-slot=playback-host]').hover();
      const cardBox = await card.boundingBox();
      const seekBox = await page.getByRole('slider', { name: 'Seek' }).boundingBox();
      if (!cardBox || !seekBox) throw new Error('the card or the seek bar has no box');
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(seekBox.y);

      await seekTo(page, 5);
      await expect(card).toHaveCount(0);

      await seekTo(page, 10);
      await expect(card).toBeVisible();
      await card.getByRole('button', { name: 'Dismiss this note' }).focus();
      await page.keyboard.press('Escape');
      await expect(card).toHaveCount(0);

      const listed = page.getByRole('region', { name: 'Corrections' });
      await expect(listed.getByText(CORRECTION.text)).toBeVisible();
    } finally {
      await creator.delete(`/v1/videos/${videoId}/corrections/${id}`);
    }
  });
});
