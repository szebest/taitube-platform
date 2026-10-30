import { expect, type Page, test } from '../../../../tests/playwright/fixtures';

const EXPANDED = { width: 1280, height: 900 };

const idOf = (position: number) =>
  `0190c3a0-5e1d-7000-8000-00000000f${String(position).padStart(3, '0')}`;

const shorts = [1, 2, 3].map((position) => ({
  id: idOf(position),
  ownerId: '0190c3a0-5e1d-7000-8000-00000000b001',
  title: `Short ${position}`,
  description: null,
  visibility: 'public',
  status: 'READY',
  format: 'short',
  channel: {
    id: '0190c3a0-5e1d-7000-8000-00000000c001',
    handle: 'marta',
    displayName: 'Marta',
    avatarUrl: null,
  },
  version: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}));

/** The browser's Shorts feed is three Shorts; the stack's own uploads are landscape, and never Shorts. */
async function serveShorts(page: Page) {
  await page.route(/\/v1\/shorts(\?|$)/, (route) =>
    route.fulfill({
      json: { items: shorts, nextCursor: null, total: shorts.length },
      headers: { 'access-control-allow-origin': '*' },
    })
  );
}

async function openShorts(page: Page) {
  await serveShorts(page);
  await page.setViewportSize(EXPANDED);
  await page.goto('/');
  await page.getByRole('link', { name: 'Shorts', exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Shorts player' })).toContainText('Short 1');
}

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
