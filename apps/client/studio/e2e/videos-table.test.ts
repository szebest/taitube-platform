import { expect, test } from '../../../../tests/playwright/fixtures';

for (const width of [768, 1280]) {
  test(`the library table keeps each row's actions in reach at ${width} px`, async ({
    page,
    signIn,
  }) => {
    await signIn('creator');
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/videos', { waitUntil: 'networkidle' });

    const actions = page.getByRole('button', { name: /^Actions for / }).first();
    await actions.scrollIntoViewIfNeeded();
    const box = await actions.boundingBox();

    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(await actions.isVisible()).toBe(true);
  });
}

test('a video address with nothing after it opens the library', async ({ page, signIn, stack }) => {
  await signIn('creator');

  await page.goto(`/videos/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/videos\/?$/);
  await expect(page.getByRole('table', { name: 'Your videos' })).toBeVisible();
});
