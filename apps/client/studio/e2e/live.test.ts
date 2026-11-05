import { expect, test } from '../../../../tests/playwright/fixtures';

interface OpenedStream {
  ingest: { overlayToken: string };
}

test.describe('live', () => {
  test('the dashboard masks the stream key until the creator reveals it', async ({
    page,
    signIn,
  }) => {
    await signIn('creator');
    await page.goto('/live');

    const key = page.getByLabel('Stream key');

    await expect(page.getByRole('heading', { name: 'Connect your encoder' })).toBeVisible();
    await expect(key).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Reveal Stream key' }).click();
    await expect(key).toHaveAttribute('type', 'text');
    await expect(key).not.toHaveValue('');
  });

  test('the goal overlay opens on its token alone, with no studio around it', async ({
    page,
    signIn,
    api,
  }) => {
    await signIn('creator');
    const creator = await api('creator');
    const opened = (await (await creator.post('/v1/me/live')).json()) as OpenedStream;

    await page.goto(`/live/overlay/${opened.ingest.overlayToken}?widget=goal`);

    await expect(page.getByRole('progressbar', { name: 'Subscriber goal' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });
});
