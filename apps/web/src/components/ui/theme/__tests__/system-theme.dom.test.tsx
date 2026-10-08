import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { stubColorScheme } from '#app/__tests__/color-scheme';
import { SYSTEM_THEME_SCRIPT, useSystemTheme } from '../system-theme';

function SystemTheme() {
  return <output>{useSystemTheme()}</output>;
}

describe('apps/web: system theme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it.each(['dark', 'light'] as const)('reads a %s system scheme', (scheme) => {
    stubColorScheme(scheme);

    render(<SystemTheme />);

    expect(screen.getByRole('status')).toHaveTextContent(scheme);
  });

  it('follows the system when it changes', () => {
    const system = stubColorScheme('dark');
    render(<SystemTheme />);

    act(() => system.change('light'));

    expect(screen.getByRole('status')).toHaveTextContent('light');
  });

  it('renders dark on the server, which cannot see the system', () => {
    stubColorScheme('light');

    expect(renderToString(<SystemTheme />)).toContain('dark');
  });

  it.each(['dark', 'light'] as const)(
    'has the head script mark the document %s before paint',
    (scheme) => {
      stubColorScheme(scheme);

      Function(SYSTEM_THEME_SCRIPT)();

      expect(document.documentElement.dataset.theme).toBe(scheme);
    }
  );
});
