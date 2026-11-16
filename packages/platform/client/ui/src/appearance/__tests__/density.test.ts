import { densityOf } from '../density';
import { DEFAULT_APPEARANCE } from '../preference';
import { resolveAppearance } from '../resolve';

const sets = (overrides: Parameters<typeof resolveAppearance>[0]['overrides']) =>
  resolveAppearance({ ...DEFAULT_APPEARANCE, overrides }, { reducedMotion: false }).sets;

describe('@vp/ui: density', () => {
  it.each([
    { label: 'the theme own spacing and sizing', overrides: {}, density: 'comfortable' },
    {
      label: 'compact spacing and small sizing',
      overrides: { spacing: 'compact', sizing: 'small' },
      density: 'compact',
    },
    { label: 'compact spacing alone', overrides: { spacing: 'compact' }, density: 'comfortable' },
    { label: 'small sizing alone', overrides: { sizing: 'small' }, density: 'comfortable' },
  ] as const)('reads $label as $density', ({ overrides, density }) => {
    expect(densityOf(sets(overrides))).toBe(density);
  });
});
