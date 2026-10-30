import { expect, test } from '../../../../tests/playwright/fixtures';

const CLIP = { startMs: 0, endMs: 5000, title: 'E2E clip' };

test.describe('clips', () => {
  test('a member clips a video, gets the link and anyone opens it', async ({
    page,
    context,
    signIn,
    stack,
  }) => {
    const { clippable } = stack.videos;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signIn('viewer');
    await page.goto(`/watch/${clippable.id}`);

    await page.getByRole('button', { name: 'Clip', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Clip this video' });
    await dialog.getByRole('textbox', { name: 'Title' }).fill(CLIP.title);
    await dialog.getByRole('button', { name: 'Save clip' }).click();

    await expect(page.getByText('Clip saved, link copied', { exact: true })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/clip\/[0-9a-f-]{36}$/);

    await context.clearCookies();
    await page.goto(link);

    await expect(page.getByRole('heading', { level: 1, name: CLIP.title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watch the full video' })).toHaveAttribute(
      'href',
      new RegExp(`/watch/${clippable.id}\\?t=\\d+$`)
    );
    await expect(page.getByRole('button', { name: 'Delete clip' })).toHaveCount(0);
  });

  test('a guest asking for a clip is sent to sign-in', async ({ page, stack }) => {
    await page.goto(`/watch/${stack.videos.clippable.id}`);

    await page.getByRole('button', { name: 'Clip', exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('its creator deletes a clip and the link stops resolving', async ({
    page,
    api,
    signIn,
    stack,
  }) => {
    const viewer = await api('viewer');
    const created = await viewer.post(`/v1/videos/${stack.videos.clippable.id}/clips`, {
      data: CLIP,
    });
    const { id } = await created.json();
    await signIn('viewer');
    await page.goto(`/clip/${id}`);

    await page.getByRole('button', { name: 'Delete clip' }).click();
    await page
      .getByRole('alertdialog', { name: 'Delete this clip?' })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    await expect(page).toHaveURL(new RegExp(`/watch/${stack.videos.clippable.id}$`));
    await page.goto(`/clip/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist.');
  });
});
