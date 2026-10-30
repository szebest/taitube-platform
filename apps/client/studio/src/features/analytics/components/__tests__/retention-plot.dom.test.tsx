import { render } from '@testing-library/react';
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

import { AppProviders } from '#app/__tests__/providers';
import { RETENTION_FILL, RetentionPlot } from '../retention-plot';

describe('apps/client/studio: RetentionPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = render(
      <AppProviders>
        <RetentionPlot
          curve={[
            { percent: 0, viewers: 10 },
            { percent: 5, viewers: 4 },
          ]}
          name="Viewers"
        />
      </AppProviders>
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });

  describe('bar colour', () => {
    const MODES = [
      { mode: 'dark', palette: 'categorical-dark' },
      { mode: 'light', palette: 'categorical-light' },
      { mode: 'oled', palette: 'categorical-dark' },
    ] as const;

    const resolved = (theme: (typeof appearance.themes)[number]): ResolvedTheme =>
      expectOk(resolveTheme(expectOk(parseTheme(theme)), ramps));

    const FILL_ON_SURFACE = appearance.themes.map(resolved).flatMap((theme) =>
      MODES.map(({ mode, palette }) => {
        const index = Number(/categorical-(\d+)/.exec(RETENTION_FILL)?.[1]) - 1;
        const surface =
          mode === 'oled'
            ? (theme.color.oled.surface ?? theme.color.dark.surface)
            : theme.color[mode].surface;
        return { theme: theme.id, mode, colour: theme.dataviz[palette][index] ?? '', surface };
      })
    );

    it('is a categorical series colour', () => {
      expect(RETENTION_FILL).toMatch(/^var\(--dataviz-categorical-\d+\)$/);
    });

    it.each(FILL_ON_SURFACE)(
      'keeps the bars of $theme in $mode at 3:1 against the surface',
      ({ colour, surface }) => {
        expect(contrastRatio(colour, surface)).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
      }
    );
  });
});
