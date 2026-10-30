import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

async function document(cookie = ''): Promise<string> {
  return (await serverRender(getRouter, '/no-such-page', { headers: { cookie } })).html;
}

function head(html: string): string {
  return html.split('</head>')[0] ?? '';
}

function htmlTag(html: string): string {
  return html.slice(html.indexOf('<html'), html.indexOf('><head>'));
}

const SETTLES_SYSTEM_MODE = "matchMedia('(prefers-color-scheme: light)')";

describe('apps/client/studio: root route', () => {
  it('renders the whole document, titled for the studio and closed to search engines', async () => {
    const html = await document();

    expect(html.startsWith('<!DOCTYPE html><html lang="en" data-theme="sand"')).toBe(true);
    expect(html).toContain('<title>Taitube Studio</title>');
    expect(head(html)).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(head(html)).not.toContain('name="description"');
  });

  it('links the stylesheets from the document head, the design system before the app', async () => {
    const links = head(await document()).match(/<link rel="stylesheet" href="[^"]+"/g) ?? [];

    expect(links).toHaveLength(2);
    expect(links[0]).toContain('styles');
    expect(links[1]).toContain('studio.css');
  });

  it.each([
    { cookie: 'vp.theme=light', mode: 'light' },
    { cookie: 'vp.theme=dark', mode: 'dark' },
  ])(
    'server-renders the mode of cookie "$cookie" on <html>: $mode, on compact spacing and small sizing',
    async ({ cookie, mode }) => {
      const html = await document(cookie);

      expect(htmlTag(html)).toContain(`data-theme="sand" data-mode="${mode}"`);
      expect(htmlTag(html)).toContain('data-spacing="compact" data-sizing="small"');
      expect(head(html)).not.toContain(SETTLES_SYSTEM_MODE);
    }
  );

  it('settles the system mode in the head, before the body paints, with no cookie', async () => {
    expect(head(await document())).toContain(SETTLES_SYSTEM_MODE);
  });

  it('frames every page in the studio shell, with the toast region', async () => {
    const html = await document();

    expect(html).toContain('Creator Studio');
    expect(html).toContain('Back to Taitube');
    expect(html.match(/aria-label="Notifications \(F8\)"/g)).toHaveLength(1);
  });
});
