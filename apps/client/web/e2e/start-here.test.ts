import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('start here', () => {
  test.describe.configure({ mode: 'serial' });

  test('a creator pins three videos in the studio and the channel page shows them in that order', async ({
    page,
    api,
    signIn,
    alongsideUrl,
    stack,
  }) => {
    const { watchable, canvas, clippable } = stack.videos;
    await signIn('creator');
    await page.goto(`${alongsideUrl}/customization`);
    const section = page.getByRole('form', { name: 'Start here' });

    for (const video of [watchable, canvas, clippable]) {
      await section.getByRole('button', { name: 'Add videos' }).click();
      await page.getByRole('option', { name: video.title }).click();
      await page.keyboard.press('Escape');
    }
    await section.getByRole('button', { name: `Reorder ${clippable.title}` }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await section.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Start here saved', { exact: true })).toBeVisible();

    const account = await (await api('creator')).get('/v1/me/account');
    const { channel } = (await account.json()) as { channel: { id: string } };
    await page.goto(`/channel/${channel.id}`);

    const shelf = page.getByRole('region', { name: 'Start here' });
    await expect(shelf.getByRole('listitem')).toHaveCount(3);
    await expect(shelf.getByRole('listitem')).toContainText([
      clippable.title,
      watchable.title,
      canvas.title,
    ]);
  });

  test('a channel that pins nothing shows its most-watched videos', async ({ page, api }) => {
    const creator = await api('creator');
    await creator.put('/v1/me/channel/featured', { data: { videoIds: [] } });
    const account = await (await creator.get('/v1/me/account')).json();

    await page.goto(`/channel/${(account as { channel: { id: string } }).channel.id}`);

    await expect(page.getByRole('region', { name: 'Most watched' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Start here' })).toHaveCount(0);
  });
});
