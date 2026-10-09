import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { stubColorScheme } from '#app/__tests__/color-scheme';
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

function renderTheme(preference: ThemePreference) {
  return render(
    <ThemeProvider preference={preference}>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe('apps/web: theme provider', () => {
  afterEach(() => {
    document.cookie = 'vp.theme=; Max-Age=0; Path=/';
  });

  it.each([
    { preference: 'dark', system: 'light', shown: 'dark shows dark' },
    { preference: 'light', system: 'dark', shown: 'light shows light' },
    { preference: 'system', system: 'light', shown: 'system shows light' },
  ] as const)(
    'starts from the $preference preference the server read',
    ({ preference, system, shown }) => {
      stubColorScheme(system);

      renderTheme(preference);

      expect(screen.getByRole('status')).toHaveTextContent(shown);
    }
  );

  it('follows the system while the preference is system', () => {
    const system = stubColorScheme('dark');
    renderTheme('system');

    act(() => system.change('light'));

    expect(screen.getByRole('status')).toHaveTextContent('system shows light');
  });

  it('applies a new preference at once and keeps it in the cookie', async () => {
    stubColorScheme('dark');
    renderTheme('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Light' }));

    expect(screen.getByRole('status')).toHaveTextContent('light shows light');
    expect(document.cookie).toBe('vp.theme=light');
  });

  it('refuses useTheme outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ThemeProbe />)).toThrow('useTheme must be used within ThemeProvider');
  });
});
