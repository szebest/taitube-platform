import type { Browser } from '@playwright/test';

import { expect, type Persona, type Stack, test } from '../../../../tests/playwright/fixtures';
import { sessionCookie } from '../../../../tests/playwright/session-cookie';

// React's production build names a hydration mismatch only by its error code.
const HYDRATION_ERROR = /hydrat|react\.dev\/errors\/(418|419|423|425)/i;

// A page with no clock-dependent text: the legacy home feed's relative dates can differ by a second
// between the server and the browser, which is a mismatch of its own, not the shell's.
const SHELL_PAGE = '/search';

const GUEST_ICONS = ['Home', 'Shorts', 'Trending'];
const GUEST_LINKS = ['Home', 'Shorts', 'Trending', 'Live'];
const SIGNED_IN_LINKS = [
  'Home',
  'Shorts',
  'Subscriptions',
  'Trending',
  'Live',
  'Your channel',
  'Your videos',
];

const ICON_RAIL = {
  label: 'the icon rail',
  width: 1024,
  height: 768,
  sidebar: null,
  persona: null,
  nav: { width: 76 },
  links: GUEST_ICONS,
};

const ROWS = [
  {
    label: 'the bottom bar',
    width: 375,
    height: 812,
    sidebar: null,
    persona: null,
    nav: { x: 0, y: 812 - 56, height: 56 },
    links: GUEST_ICONS,
  },
  ICON_RAIL,
  {
    label: 'the drawer',
    width: 1440,
    height: 900,
    sidebar: null,
    persona: null,
    nav: { width: 248 },
    links: GUEST_LINKS,
  },
  {
    label: 'the rail of a collapsed drawer',
    width: 1440,
    height: 900,
    sidebar: 'collapsed',
    persona: null,
    nav: { width: 76 },
    links: GUEST_ICONS,
  },
  {
    label: 'the drawer of a signed-in viewer',
    width: 1440,
    height: 900,
    sidebar: null,
    persona: 'creator',
    nav: { width: 248 },
    links: SIGNED_IN_LINKS,
  },
] satisfies Array<{
  label: string;
  width: number;
  height: number;
  sidebar: 'collapsed' | null;
  persona: Persona | null;
  nav: { x?: number; y?: number; width?: number; height?: number };
  links: string[];
}>;

type Row = (typeof ROWS)[number];

async function openShell(
  browser: Browser,
  baseURL: string,
  stack: Stack,
  row: Row,
  javaScriptEnabled: boolean
) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  if (row.sidebar) {
    await context.addCookies([{ name: 'vp.sidebar', value: row.sidebar, url: baseURL }]);
  }
  if (row.persona) {
    await context.addCookies([sessionCookie(stack.personas[row.persona], baseURL)]);
  }

  const page = await context.newPage();
  await page.setViewportSize({ width: row.width, height: row.height });
  const hydrationErrors: string[] = [];
  const recordHydrationError = (text: string) => {
    if (HYDRATION_ERROR.test(text)) {
      hydrationErrors.push(text);
    }
  };
  page.on('console', (message) => {
    if (message.type() === 'error') {
      recordHydrationError(message.text());
    }
  });
  page.on('pageerror', (error) => recordHydrationError(error.message));
  await page.goto(SHELL_PAGE, { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'Main' });

  return { context, nav, hydrationErrors };
}

test.describe('shell', () => {
  for (const row of ROWS) {
    test(`at ${row.width}px shows ${row.label}, laid out by the server as it hydrates`, async ({
      browser,
      baseURL,
      stack,
    }) => {
      const server = await openShell(browser, baseURL ?? '', stack, row, false);
      const serverBox = await server.nav.boundingBox();
      await server.context.close();

      const live = await openShell(browser, baseURL ?? '', stack, row, true);
      await expect(live.nav.getByRole('link')).toHaveText(row.links);

      expect(serverBox).toMatchObject(row.nav);
      expect(await live.nav.boundingBox()).toEqual(serverBox);
      expect(live.hydrationErrors).toEqual([]);
      await live.context.close();
    });
  }

  test('at 1024px opens the rail over the content from the menu, without moving the page', async ({
    browser,
    baseURL,
    stack,
  }) => {
    const { context, nav } = await openShell(browser, baseURL ?? '', stack, ICON_RAIL, true);
    const page = nav.page();
    const main = page.getByRole('main');
    const before = await main.boundingBox();
    const menu = page.getByRole('button', { name: 'Menu' });

    await menu.click();

    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => (await nav.boundingBox())?.width).toBe(248);
    await expect(nav.getByRole('link')).toHaveText(GUEST_LINKS);
    expect(await main.boundingBox()).toEqual(before);

    await page.keyboard.press('Escape');

    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await nav.boundingBox())?.width).toBe(76);
    await context.close();
  });
});
