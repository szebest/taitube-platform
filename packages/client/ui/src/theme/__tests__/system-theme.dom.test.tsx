import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { stubColorScheme } from './color-scheme';
import { SYSTEM_THEME_SCRIPT, useSystemTheme } from '../system-theme';

function SystemTheme({ shown = true }: { shown?: boolean }) {
  return <output>{useSystemTheme(shown)}</output>;
}

function renderSystemTheme(shown?: boolean) {
  return render(<SystemTheme shown={shown} />);
}

describe('@vp/ui: system theme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeSwitching;
  });

  it.each(['dark', 'light'] as const)('reads a %s system scheme', (scheme) => {
    stubColorScheme(scheme);

    renderSystemTheme();

    expect(screen.getByRole('status')).toHaveTextContent(scheme);
  });

  it('follows the system when it changes', () => {
    const system = stubColorScheme('dark');
    renderSystemTheme();

    act(() => system.change('light'));

    expect(screen.getByRole('status')).toHaveTextContent('light');
  });

  it.each([
    { label: 'holds transitions while the page wears system', shown: true, paused: true },
    {
      label: 'leaves transitions alone while the page wears another theme',
      shown: false,
      paused: false,
    },
  ])('an OS change $label', ({ shown, paused }) => {
    const system = stubColorScheme('dark');
    renderSystemTheme(shown);

    act(() => system.change('light'));

    expect(document.documentElement.hasAttribute('data-theme-switching')).toBe(paused);
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
