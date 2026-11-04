import { expect, test } from '../../../../tests/playwright/fixtures';

const HOSTILE_YELLOW = '#ffff00';

test('a brand colour set in the studio scopes its derived accent on the web channel page', async ({
  page,
  signIn,
  api,
  alongsideUrl,
}) => {
  await signIn('creator');
  const creator = await api('creator');
  const { channel } = await (await creator.get('/v1/me/account')).json();

  try {
    await page.goto(`${alongsideUrl}/customization`);
    const section = page.getByRole('form', { name: 'Brand colour' });
    await section.getByLabel('Colour').fill(HOSTILE_YELLOW);
    await expect(section.getByText('On dark')).toBeVisible();
    await section.getByRole('button', { name: 'Save' }).click();
    await expect(section.getByText('Saved')).toBeVisible();

    await page.goto(`/channel/${channel.id}`, { waitUntil: 'networkidle' });
    const scoped = page.locator('[data-brand="ffff00"]');
    await expect(scoped).toHaveCount(1);
    const accentOf = (selector: string) =>
      page.evaluate(
        (css) =>
          getComputedStyle(document.querySelector(css) as Element)
            .getPropertyValue('--accent')
            .trim(),
        selector
      );
    const themeAccent = await accentOf('html');
    const channelAccent = await accentOf('[data-brand="ffff00"]');
    expect(channelAccent).not.toBe('');
    expect(channelAccent).not.toBe(themeAccent);
  } finally {
    await creator.patch('/v1/me/channel', { data: { brandColor: null } });
  }
});
