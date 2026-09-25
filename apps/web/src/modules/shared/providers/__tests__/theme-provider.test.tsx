import { renderToStaticMarkup } from 'react-dom/server';
import { stubBrowser } from '../../../../__tests__/browser';
import { asLivePage } from '../../../../__tests__/live-page';
import { ThemeProvider, useTheme } from '../theme-provider';

vi.mock(import('react'), async (importOriginal) =>
  (await import('../../../../__tests__/live-page')).withLivePage(await importOriginal())
);

type ThemeControls = Partial<ReturnType<typeof useTheme>>;

function renderTheme(controls: ThemeControls = {}): string {
  function ThemeProbe() {
    const theme = useTheme();
    Object.assign(controls, theme);
    return <span>{`theme=${theme.theme}`}</span>;
  }

  return renderToStaticMarkup(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe('apps/web: theme provider', () => {
  it.each([
    { prefersDark: true, theme: 'dark' },
    { prefersDark: false, theme: 'light' },
  ])(
    'follows the system preference on a first visit: dark=$prefersDark',
    ({ prefersDark, theme }) => {
      stubBrowser({ prefersDark });

      expect(asLivePage(() => renderTheme())).toContain(`theme=${theme}`);
    }
  );

  it('keeps the theme the viewer chose over the system preference', () => {
    stubBrowser({ prefersDark: true, stored: { THEME: '"light"' } });

    expect(asLivePage(() => renderTheme())).toContain('theme=light');
  });

  it('renders the light theme on the server, whatever the viewer chose', () => {
    stubBrowser({ prefersDark: true, stored: { THEME: '"dark"' } });

    expect(renderTheme()).toContain('theme=light');
  });

  it('remembers a changed theme', () => {
    const storage = stubBrowser();
    const controls: ThemeControls = {};
    renderTheme(controls);

    controls.changeTheme?.('dark');

    expect(storage.get('THEME')).toBe('"dark"');
  });

  it('refuses useTheme outside the provider', () => {
    function Orphan() {
      useTheme();
      return null;
    }

    expect(() => renderToStaticMarkup(<Orphan />)).toThrow(
      'useTheme must be used within ThemeProvider'
    );
  });
});
