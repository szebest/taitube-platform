import { recordRequests } from '#app/__tests__/api-store';
import { serverRender } from '#app/__tests__/server-render';
import { SYSTEM_THEME_SCRIPT } from '#app/components/ui/theme/system-theme';

async function home(cookie = ''): Promise<string> {
  recordRequests();
  return (await serverRender('/', { headers: { cookie } })).html;
}

function head(html: string): string {
  return html.split('</head>')[0] ?? '';
}

describe('apps/web: root route', () => {
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
    { cookie: '', theme: 'dark' },
    { cookie: 'vp.theme=sepia', theme: 'dark' },
  ])(
    'server-renders the theme of cookie "$cookie" on <html>: $theme',
    async ({ cookie, theme }) => {
      const html = await home(cookie);

      expect(html).toContain(`<html lang="en" data-theme="${theme}">`);
      expect(html).not.toContain(SYSTEM_THEME_SCRIPT);
    }
  );

  it('resolves a system preference in the head, before the body paints', async () => {
    const html = await home('vp.theme=system');

    expect(head(html)).toContain(`<script>${SYSTEM_THEME_SCRIPT};document.currentScript.remove()`);
  });

  it('frames every page in the legacy layout', async () => {
    const html = await home();

    expect(html).toContain('aria-label="toggle sidebar"');
    expect(html).toContain('href="/trending"');
  });
});
