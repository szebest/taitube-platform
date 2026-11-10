import { serverRender } from '@vp/web-testing/server';
import { getRouter } from '#app/router';

async function document(cookie = '', acceptLanguage = 'en'): Promise<string> {
  const headers = { cookie, 'accept-language': acceptLanguage };
  return (await serverRender(getRouter, '/no-such-page', { headers })).html;
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

    expect(html.startsWith('<!DOCTYPE html><html lang="en" dir="ltr" data-theme="sand"')).toBe(
      true
    );
    expect(html).toContain('<title>Taitube Studio</title>');
    expect(head(html)).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(head(html)).not.toContain('name="description"');
  });

  it('lets the page draw under a notch, so safe-area insets are real', async () => {
    const html = await document();

    expect(head(html)).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>'
    );
  });

  it.each([
    { acceptLanguage: 'pl-PL,en;q=0.5', lang: 'pl', notFound: 'Nie znaleziono strony' },
    { acceptLanguage: 'de-DE', lang: 'en', notFound: 'Page not found' },
  ])(
    'renders in the locale Accept-Language "$acceptLanguage" negotiates: $lang',
    async ({ acceptLanguage, lang, notFound }) => {
      const html = await document('', acceptLanguage);

      expect(htmlTag(html)).toMatch(new RegExp(`^<html lang="${lang}" dir="ltr" `));
      expect(html).toContain(notFound);
      expect(html).toContain(`locale:"${lang}"`);
    }
  );

  it('links the design system as the one stylesheet in the document head', async () => {
    const links = head(await document()).match(/<link rel="stylesheet" href="[^"]+"/g) ?? [];

    expect(links).toHaveLength(1);
    expect(links[0]).toContain('styles');
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
