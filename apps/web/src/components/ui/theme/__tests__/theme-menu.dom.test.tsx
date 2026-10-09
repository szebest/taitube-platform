import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { stubColorScheme } from '#app/__tests__/color-scheme';
import { ThemeMenu } from '../theme-menu';
import type { ThemePreference } from '../theme-preference';
import { ThemeProvider, useTheme } from '../theme-provider';

function ShownTheme() {
  const { theme } = useTheme();
  return <output>{theme}</output>;
}

function renderMenu(preference: ThemePreference) {
  return render(
    <ThemeProvider preference={preference}>
      <ThemeMenu />
      <ShownTheme />
    </ThemeProvider>
  );
}

describe('apps/web: ThemeMenu', () => {
  afterEach(() => {
    document.cookie = 'vp.theme=; Max-Age=0; Path=/';
  });

  it.each([
    { preference: 'light', name: 'Theme: Light' },
    { preference: 'dark', name: 'Theme: Dark' },
    { preference: 'system', name: 'Theme: System' },
  ] as const)('names its button after the $preference choice', ({ preference, name }) => {
    stubColorScheme('dark');

    renderMenu(preference);

    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it('checks the current choice and switches to the one picked from the keyboard', async () => {
    stubColorScheme('dark');
    renderMenu('system');

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeChecked();
    await userEvent.keyboard('{Home}{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent('light');
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toHaveFocus();
    expect(document.cookie).toBe('vp.theme=light');
  });

  it('passes axe open', async () => {
    stubColorScheme('dark');
    renderMenu('system');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(await axeViolations()).toEqual([]);
  });
});
