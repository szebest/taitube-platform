import { expect, type Page } from '../../../../tests/playwright/fixtures';

export const EXPANDED = { width: 1280, height: 900 };

export const idOf = (position: number) =>
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
export async function serveShorts(page: Page) {
  await page.route(/\/v1\/shorts(\?|$)/, (route) =>
    route.fulfill({
      json: { items: shorts, nextCursor: null, total: shorts.length },
      headers: { 'access-control-allow-origin': '*' },
    })
  );
}

async function serveShortDetails(page: Page) {
  for (const short of shorts) {
    await page.route(new RegExp(`/v1/videos/${short.id}$`), (route) =>
      route.fulfill({ json: short, headers: { 'access-control-allow-origin': '*' } })
    );
    await page.route(new RegExp(`/v1/videos/${short.id}/captions$`), (route) =>
      route.fulfill({ json: { tracks: [] }, headers: { 'access-control-allow-origin': '*' } })
    );
  }
}

export async function openShorts(page: Page) {
  await serveShorts(page);
  await serveShortDetails(page);
  await page.setViewportSize(EXPANDED);
  await page.goto('/');
  await page.getByRole('link', { name: 'Shorts', exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Shorts player' })).toContainText('Short 1');
}
