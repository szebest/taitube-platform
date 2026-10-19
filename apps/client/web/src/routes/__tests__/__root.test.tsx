import { SYSTEM_THEME_SCRIPT } from '@vp/ui';
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

describe('apps/client/web: root route', () => {
  it('renders the whole document, so no static HTML shell is needed', async () => {
    const html = await home();

    expect(html.startsWith('<!DOCTYPE html><html lang="en" data-theme="dark"><head>')).toBe(true);
    expect(html).toContain('<title>Taitube</title>');
    expect(html).toContain('<meta name="description" content="Share videos with others online!"/>');
  });

  it('links the global stylesheets from the document head, the design system last', async () => {
    const links = head(await home()).match(/<link rel="stylesheet" href="[^"]+"/g) ?? [];

    expect(links).toHaveLength(4);
    expect(links.at(-1)).toContain('design-system.css');
  });

  it.each([
    { cookie: 'vp.theme=light', theme: 'light' },
    { cookie: 'vp.theme=dark', theme: 'dark' },
  ])(
    'server-renders the theme of cookie "$cookie" on <html>: $theme',
    async ({ cookie, theme }) => {
      const html = await home(cookie);

      expect(html).toContain(`<html lang="en" data-theme="${theme}">`);
      expect(html).not.toContain(SYSTEM_THEME_SCRIPT);
    }
  );

  it.each(['vp.theme=system', '', 'vp.theme=sepia'])(
    'resolves the system theme in the head, before the body paints, for cookie "%s"',
    async (cookie) => {
      const html = await home(cookie);

      expect(html).toContain('<html lang="en" data-theme="dark">');
      expect(head(html)).toContain(
        `<script>${SYSTEM_THEME_SCRIPT};document.currentScript.remove()`
      );
    }
  );

  it('mounts the one toast region every page shows its toasts in', async () => {
    const html = await home();

    expect(html.match(/aria-label="Notifications \(F8\)"/g)).toHaveLength(1);
  });

  it.each([
    { cookie: 'vp.sidebar=collapsed', expanded: 'false' },
    { cookie: 'vp.sidebar=expanded', expanded: 'true' },
    { cookie: '', expanded: 'true' },
  ])('server-renders the sidebar the cookie "$cookie" asks for', async ({ cookie, expanded }) => {
    const html = await home(cookie);

    expect(html).toMatch(new RegExp(`aria-label="Menu"[^>]*aria-expanded="${expanded}"`));
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
