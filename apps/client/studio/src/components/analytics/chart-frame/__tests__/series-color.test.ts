import {
  contrastRatio,
  NON_TEXT_FLOOR,
  parseTheme,
  type ResolvedTheme,
  resolveTheme,
} from '@vp/design-tokens';
import { expectOk } from '@vp/testing/result';
import { appearance } from '@vp/ui/appearance/registry';
import { ramps } from '@vp/ui/tokens/ref';

import { CHART_SERIES, seriesColor } from '../series-color';

const MODE_PALETTES = [
  { mode: 'dark', palette: 'categorical-dark' },
  { mode: 'light', palette: 'categorical-light' },
  { mode: 'oled', palette: 'categorical-dark' },
] as const;

const resolved = (theme: (typeof appearance.themes)[number]): ResolvedTheme =>
  expectOk(resolveTheme(expectOk(parseTheme(theme)), ramps));

const surfaceOf = (theme: ResolvedTheme, mode: (typeof MODE_PALETTES)[number]['mode']) =>
  mode === 'oled'
    ? (theme.color.oled.surface ?? theme.color.dark.surface)
    : theme.color[mode].surface;

const SERIES_ON_SURFACE = appearance.themes.map(resolved).flatMap((theme) =>
  MODE_PALETTES.flatMap(({ mode, palette }) =>
    CHART_SERIES.map((series) => ({
      theme: theme.id,
      mode,
      series,
      colour: theme.dataviz[palette][series] ?? '',
      surface: surfaceOf(theme, mode),
    }))
  )
);

describe('apps/client/studio: seriesColor', () => {
  it.each(CHART_SERIES)('paints series %i with its categorical variable', (series) => {
    expect(seriesColor(series)).toBe(`var(--dataviz-categorical-${series + 1})`);
  });

  it('is checked for every theme and mode the registry offers', () => {
    expect(SERIES_ON_SURFACE).toHaveLength(
      appearance.themes.length * MODE_PALETTES.length * CHART_SERIES.length
    );
  });

  it.each(SERIES_ON_SURFACE)(
    'keeps series $series of $theme in $mode at 3:1 against the surface',
    ({ colour, surface }) => {
      expect(contrastRatio(colour, surface)).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
    }
  );
});
