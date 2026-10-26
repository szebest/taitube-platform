import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

async function home(cookie = ''): Promise<string> {
  return (await serverRender(getRouter, '/', { handlers: loaderApi(), headers: { cookie } })).html;
}

function head(html: string): string {
  return html.split('</head>')[0] ?? '';
}

function htmlTag(html: string): string {
  return html.slice(html.indexOf('<html'), html.indexOf('><head>'));
}

const SETTLES_SYSTEM_MODE = "matchMedia('(prefers-color-scheme: light)')";

const APPEARANCE_COOKIE = `vp.appearance=${encodeURIComponent(JSON.stringify({ schema: 2, theme: 'nocturne', mode: 'oled' }))}`;

describe('apps/client/web: root route', () => {
  it('renders the whole document, so no static HTML shell is needed', async () => {
    const html = await home();

    expect(html.startsWith('<!DOCTYPE html><html lang="en" data-theme="sand"')).toBe(true);
    expect(html).toContain('<title>Taitube</title>');
    expect(html).toContain('<meta name="description" content="Share videos with others online!"/>');
  });

  it('links the global stylesheets from the document head, the design system last', async () => {
    const links = head(await home()).match(/<link rel="stylesheet" href="[^"]+"/g) ?? [];

    expect(links).toHaveLength(4);
    expect(links.at(-1)).toContain('styles');
  });

  it.each([
    { cookie: 'vp.theme=light', theme: 'sand', mode: 'light' },
    { cookie: 'vp.theme=dark', theme: 'sand', mode: 'dark' },
    { cookie: APPEARANCE_COOKIE, theme: 'nocturne', mode: 'oled' },
  ])(
    'server-renders the appearance of cookie "$cookie" on <html>: $theme $mode, the theme default sets',
    async ({ cookie, theme, mode }) => {
      const html = await home(cookie);

      expect(htmlTag(html)).toContain(
        `data-theme="${theme}" data-mode="${mode}" data-contrast="standard"`
      );
      expect(htmlTag(html)).toContain('data-spacing="default" data-sizing="medium"');
      expect(head(html)).not.toContain(SETTLES_SYSTEM_MODE);
    }
  );

  it.each(['vp.theme=system', '', 'vp.theme=sepia'])(
    'settles the system mode in the head, before the body paints, for cookie "%s"',
    async (cookie) => {
      const html = await home(cookie);

      expect(htmlTag(html)).toContain('data-theme="sand" data-mode="dark"');
      expect(head(html)).toContain(SETTLES_SYSTEM_MODE);
    }
  );

  it('mounts the one toast region every page shows its toasts in', async () => {
    const html = await home();

    expect(html.match(/aria-label="Notifications \(F8\)"/g)).toHaveLength(1);
  });

  it.each([
    { cookie: 'vp.sidebar=collapsed', state: 'collapsed' },
    { cookie: 'vp.sidebar=expanded', state: 'open' },
    { cookie: '', state: 'open' },
  ])('server-renders the sidebar the cookie "$cookie" asks for', async ({ cookie, state }) => {
    const html = await home(cookie);

    expect(html).toMatch(new RegExp(`data-slot="app-shell-rail"[^>]*data-state="${state}"`));
    expect(html).toContain('href="/feed/trending"');
  });

  it.each([
    { viewer: 'a signed-in viewer', cookie: SESSION, signInLink: false },
    { viewer: 'a guest', cookie: '', signInLink: true },
  ])('server-renders the header of $viewer', async ({ cookie, signInLink }) => {
    const html = await home(cookie);

    expect(html).toContain('aria-label="Menu"');
    expect(html.includes('>Sign in</a>')).toBe(signInLink);
  });
});
