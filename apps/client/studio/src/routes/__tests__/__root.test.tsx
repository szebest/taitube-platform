import { SYSTEM_THEME_SCRIPT } from '@vp/ui';
import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

async function document(cookie = ''): Promise<string> {
  return (await serverRender(getRouter, '/no-such-page', { headers: { cookie } })).html;
}

function head(html: string): string {
  return html.split('</head>')[0] ?? '';
}

describe('apps/client/studio: root route', () => {
  it('renders the whole document, titled for the studio and closed to search engines', async () => {
    const html = await document();

    expect(html.startsWith('<!DOCTYPE html><html lang="en" data-theme="dark"><head>')).toBe(true);
    expect(html).toContain('<title>Taitube Studio</title>');
    expect(head(html)).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(head(html)).not.toContain('name="description"');
  });

  it('links the stylesheets from the document head, the design system before the app', async () => {
    const links = head(await document()).match(/<link rel="stylesheet" href="[^"]+"/g) ?? [];

    expect(links).toHaveLength(3);
    expect(links[1]).toContain('design-system.css');
    expect(links[2]).toContain('studio.css');
  });

  it.each([
    { cookie: 'vp.theme=light', theme: 'light' },
    { cookie: 'vp.theme=dark', theme: 'dark' },
  ])('server-renders the theme of cookie "$cookie" on <html>: $theme', async ({ cookie, theme }) => {
    const html = await document(cookie);

    expect(html).toContain(`<html lang="en" data-theme="${theme}">`);
    expect(html).not.toContain(SYSTEM_THEME_SCRIPT);
  });

  it('resolves the system theme in the head, before the body paints, with no cookie', async () => {
    expect(head(await document())).toContain(`<script>${SYSTEM_THEME_SCRIPT}`);
  });

  it('frames every page in the studio shell, with the toast region', async () => {
    const html = await document();

    expect(html).toContain('Creator Studio');
    expect(html).toContain('Back to Taitube');
    expect(html.match(/aria-label="Notifications \(F8\)"/g)).toHaveLength(1);
  });
});
