import type { Browser } from '@playwright/test';

import {
  AUTH_TOKEN_KEY,
  type Persona,
  type Stack,
  expect,
  test,
} from '../../../../tests/playwright/fixtures';

// React's production build names a hydration mismatch only by its error code.
const HYDRATION_ERROR = /hydrat|react\.dev\/errors\/(418|419|423|425)/i;

// A page with no clock-dependent text: the legacy home feed's relative dates can differ by a second
// between the server and the browser, which is a mismatch of its own, not the shell's.
const SHELL_PAGE = '/search';

const GUEST_LINKS = ['Home', 'Trending'];
const SIGNED_IN_LINKS = ['Home', 'Subscriptions', 'Trending', 'Your channel', 'Your videos'];

const ROWS = [
  {
    label: 'the bottom bar',
    width: 375,
    height: 812,
    sidebar: null,
    persona: null,
    nav: { x: 0, y: 812 - 56, height: 56 },
    links: GUEST_LINKS,
  },
  {
    label: 'the icon rail',
    width: 1024,
    height: 768,
    sidebar: null,
    persona: null,
    nav: { width: 72 },
    links: GUEST_LINKS,
  },
  {
    label: 'the drawer',
    width: 1440,
    height: 900,
    sidebar: null,
    persona: null,
    nav: { width: 240 },
    links: GUEST_LINKS,
  },
  {
    label: 'the rail of a collapsed drawer',
    width: 1440,
    height: 900,
    sidebar: 'collapsed',
    persona: null,
    nav: { width: 72 },
    links: GUEST_LINKS,
  },
  {
    label: 'the drawer of a signed-in viewer',
    width: 1440,
    height: 900,
    sidebar: null,
    persona: 'creator',
    nav: { width: 240 },
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
    await context.addInitScript(([key, token]) => window.localStorage.setItem(key, token), [
      AUTH_TOKEN_KEY,
      stack.personas[row.persona],
    ] as const);
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
});
