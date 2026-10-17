import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { stubColorScheme } from './color-scheme';
import { writeCookie } from '../../cookies/cookie';
import type { ThemePreference } from '../theme-preference';
import { ThemeProvider, useTheme } from '../theme-provider';

function ThemeProbe() {
  const { preference, theme, setPreference } = useTheme();
  return (
    <>
      <output>{`${preference} shows ${theme}`}</output>
      <button type="button" onClick={() => setPreference('light')}>
        Light
      </button>
    </>
  );
}

function renderTheme({
  preference = 'dark',
  cookieDomain,
  provided = true,
}: {
  preference?: ThemePreference;
  cookieDomain?: string;
  provided?: boolean;
} = {}) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      provided ? (
        <ThemeProvider preference={preference} cookieDomain={cookieDomain}>
          <ThemeProbe />
        </ThemeProvider>
      ) : (
        <ThemeProbe />
      )
    ),
  };
}

describe('@vp/ui: theme provider', () => {
  afterEach(() => {
    writeCookie('vp.theme', '', { maxAge: 0 });
  });

  it.each([
    { preference: 'dark', system: 'light', shown: 'dark shows dark' },
    { preference: 'light', system: 'dark', shown: 'light shows light' },
    { preference: 'system', system: 'light', shown: 'system shows light' },
  ] as const)(
    'starts from the $preference preference the server read',
    ({ preference, system, shown }) => {
      stubColorScheme(system);

      renderTheme({ preference });

      expect(screen.getByRole('status')).toHaveTextContent(shown);
    }
  );

  it('follows the system while the preference is system', () => {
    const system = stubColorScheme('dark');
    renderTheme({ preference: 'system' });

    act(() => system.change('light'));

    expect(screen.getByRole('status')).toHaveTextContent('system shows light');
  });

  it('applies a new preference at once and keeps it in the cookie', async () => {
    stubColorScheme('dark');
    const { user } = renderTheme();

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(screen.getByRole('status')).toHaveTextContent('light shows light');
    expect(document.cookie).toBe('vp.theme=light');
  });

  it('writes the cookie on the domain both apps share, when the app names one', async () => {
    stubColorScheme('dark');
    const set = vi.spyOn(document, 'cookie', 'set');
    const { user } = renderTheme({ cookieDomain: 'taitube.local' });

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(set).toHaveBeenCalledWith(
      expect.stringContaining('vp.theme=light; Max-Age=31536000; Domain=taitube.local;')
    );
  });

  it('refuses useTheme outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderTheme({ provided: false })).toThrow(
      'useTheme must be used within ThemeProvider'
    );
  });
});
