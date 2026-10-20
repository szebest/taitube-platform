import { expectOk } from '@vp/testing/result';
import { parseTheme, resolveTheme } from '../parse';
import { refFromTokens, themeFromTokens } from '../schema/__tests__/tokens-json';
import { RefSchema } from '../schema/ref';
import type { ResolvedTheme } from '../schema/theme';
import { checkThemeContrast } from '../theme-contrast';

const resolvedSand = () =>
  expectOk(
    resolveTheme(expectOk(parseTheme(themeFromTokens('sand'))), RefSchema.parse(refFromTokens()))
  );

const failing = (theme: ResolvedTheme) =>
  checkThemeContrast(theme).map(({ mode, label }) => `${mode}: ${label}`);

describe('checkThemeContrast', () => {
  it('passes sand from tokens.json in every mode', () => {
    expect(failing(resolvedSand())).toEqual([]);
  });

  it('names the mode of each failing pair, OLED inheriting the roles it does not override from dark', () => {
    const sand = resolvedSand();
    const theme: ResolvedTheme = {
      ...sand,
      color: { ...sand.color, dark: { ...sand.color.dark, 'fg-muted': '#5A5248' } },
      dataviz: {
        ...sand.dataviz,
        'categorical-light': ['#F5EAD4', ...sand.dataviz['categorical-light'].slice(1)],
      },
    };

    expect(failing(theme)).toEqual([
      'dark: fg-muted on bg',
      'dark: fg-muted on surface',
      'dark: fg-muted on raised',
      'light: series 1 on surface',
      'oled: fg-muted on bg',
      'oled: fg-muted on surface',
      'oled: fg-muted on raised',
    ]);
  });
});
