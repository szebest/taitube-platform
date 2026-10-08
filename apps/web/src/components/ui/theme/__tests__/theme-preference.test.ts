import { requestHandler } from '@tanstack/react-start/server';
import { requestThemePreference, resolveTheme, saveThemePreference } from '../theme-preference';

async function preferenceFor(cookie: string): Promise<string> {
  const answer = requestHandler(async () => new Response(requestThemePreference()));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.text();
}

describe('apps/web: theme preference', () => {
  it.each([
    { cookie: 'vp.theme=light', preference: 'light' },
    { cookie: 'vp.theme=dark', preference: 'dark' },
    { cookie: 'vp.theme=system', preference: 'system' },
    { cookie: '', preference: 'system' },
    { cookie: 'vp.theme=sepia', preference: 'system' },
  ])('reads "$cookie" from the request as $preference', async ({ cookie, preference }) => {
    expect(await preferenceFor(cookie)).toBe(preference);
  });

  it('keeps the preference in a cookie for a year, so the next server render has it', () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    saveThemePreference('system');

    expect(document.cookie).toBe('vp.theme=system; Max-Age=31536000; Path=/; SameSite=Lax');
  });

  it.each([
    { preference: 'dark', system: 'light', theme: 'dark' },
    { preference: 'light', system: 'dark', theme: 'light' },
    { preference: 'system', system: 'light', theme: 'light' },
    { preference: 'system', system: 'dark', theme: 'dark' },
  ] as const)(
    'shows $theme for $preference when the system is $system',
    ({ preference, system, theme }) => {
      expect(resolveTheme(preference, system)).toBe(theme);
    }
  );
});
