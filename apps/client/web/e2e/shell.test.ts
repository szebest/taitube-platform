import { expect, type Page, test } from '../../../../tests/playwright/fixtures';

const VIEWPORTS = [
  { width: 375, height: 812, shape: 'the bottom bar', nav: { x: 0, width: 375, height: 56 } },
  { width: 1024, height: 768, shape: 'the icon rail', nav: { x: 0, width: 72 } },
  { width: 1440, height: 900, shape: 'the drawer', nav: { x: 0, width: 240 } },
];

async function shellBoxes(page: Page) {
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  const main = await page.getByRole('main').boundingBox();
  return { nav, main };
}

async function serverRendered(page: Page) {
  await page.route('**/*.js', (route) => route.abort('blockedbyclient'));
  await page.goto('/');
  const boxes = await shellBoxes(page);
  await page.unroute('**/*.js');
  return boxes;
}

test.describe('shell', () => {
  for (const { width, height, shape, nav } of VIEWPORTS) {
    test(`at ${width}px shows ${shape}, laid out by the server as the hydrated page has it`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });

      const server = await serverRendered(page);
      await page.goto('/', { waitUntil: 'networkidle' });
      const hydrated = await shellBoxes(page);

      expect(hydrated.nav).toMatchObject(nav);
      expect(hydrated).toEqual(server);
    });
  }
});
