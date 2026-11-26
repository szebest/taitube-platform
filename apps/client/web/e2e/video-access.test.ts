import { expect, hydrated, type Page, test } from '../../../../tests/playwright/fixtures';

const PASSWORD = 'tram-at-dusk';

const playing = (page: Page) =>
  expect
    .poll(() =>
      page.locator('video').evaluate((element: HTMLVideoElement) => ({
        paused: element.paused,
        moved: element.currentTime > 0,
      }))
    )
    .toEqual({ paused: false, moved: true });

test.describe('video access', () => {
  test('a share link plays a private video to a signed-out visitor until its creator revokes it', async ({
    page,
    api,
    stack,
  }) => {
    const { shared } = stack.videos;
    const creator = await api('creator');
    const created = await creator.post(`/v1/creator/videos/${shared.id}/share-links`, {
      data: { label: 'E2E link', expiresIn: '24h' },
    });
    expect(created.status()).toBe(201);
    const link = (await created.json()) as { id: string; token: string };

    await page.goto(`/watch/${shared.id}?s=${link.token}`);
    await expect(page.getByRole('heading', { level: 1, name: shared.title })).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    await playing(page);

    const revoked = await creator.delete(`/v1/creator/videos/${shared.id}/share-links/${link.id}`);
    expect(revoked.status()).toBe(204);
    await page.goto(`/watch/${shared.id}?s=${link.token}`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'This link no longer works' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: shared.title })).toHaveCount(0);
  });

  test('a password gate refuses a wrong password, lifts for the right one and stays lifted on a reload', async ({
    page,
    api,
    stack,
  }) => {
    const { locked } = stack.videos;
    const creator = await api('creator');
    const protectedVideo = await creator.put(`/v1/creator/videos/${locked.id}/password`, {
      data: { password: PASSWORD },
    });
    expect(protectedVideo.status()).toBe(200);

    await page.goto(`/watch/${locked.id}`);
    const gate = page.getByRole('heading', { level: 1, name: 'This video is protected' });
    await expect(gate).toBeVisible();
    const field = page.getByLabel('Password');
    await hydrated(field);
    await field.fill('not-the-password');
    await page.getByRole('button', { name: 'Watch', exact: true }).click();
    await expect(field).toHaveAccessibleDescription('That password is not right.');

    await field.fill(PASSWORD);
    await page.getByRole('button', { name: 'Watch', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: locked.title })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: locked.title })).toBeVisible();
    await expect(gate).toHaveCount(0);
  });
});
