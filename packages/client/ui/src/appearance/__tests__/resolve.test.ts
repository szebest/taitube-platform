import { TOKEN_GROUPS } from '@vp/design-tokens';
import { type AppearancePreference, DEFAULT_APPEARANCE, type TokenSetIds } from '../preference';
import { resolveAppearance } from '../resolve';

const resolvedIds = (
  preference: Partial<AppearancePreference>,
  {
    defaults,
    reducedMotion = false,
  }: Readonly<{ defaults?: TokenSetIds; reducedMotion?: boolean }> = {}
) => {
  const { theme, sets } = resolveAppearance(
    { ...DEFAULT_APPEARANCE, ...preference },
    { defaults, reducedMotion }
  );
  return {
    theme: theme.id,
    ...Object.fromEntries(TOKEN_GROUPS.map((group) => [group, sets[group].id])),
  };
};

const SAND = {
  theme: 'sand',
  typography: 'figtree',
  fontSize: 'default',
  spacing: 'default',
  sizing: 'medium',
  radius: 'round',
  border: 'hairline',
  shadow: 'soft',
  ambient: 'cinematic',
  motion: 'standard',
};

const NOCTURNE = {
  theme: 'nocturne',
  typography: 'geist',
  fontSize: 'default',
  spacing: 'default',
  sizing: 'medium',
  radius: 'sharp',
  border: 'regular',
  shadow: 'flat',
  ambient: 'subtle',
  motion: 'standard',
};

const STUDIO: TokenSetIds = { spacing: 'compact', sizing: 'small' };

describe('@vp/ui: resolving the appearance', () => {
  it.each([
    { label: 'no theme chosen: the default theme and its sets', preference: {}, resolved: SAND },
    {
      label: 'an override carried across a theme switch, the other groups on the new theme',
      preference: { theme: 'nocturne', overrides: { spacing: 'airy' } },
      resolved: { ...NOCTURNE, spacing: 'airy' },
    },
    {
      label: 'a theme and a set this registry does not offer: the default theme and its sets',
      preference: { theme: 'dusk', overrides: { spacing: 'roomy' } },
      resolved: SAND,
    },
    {
      label: 'the studio with no override: its compact spacing and small sizing',
      preference: {},
      defaults: STUDIO,
      resolved: { ...SAND, spacing: 'compact', sizing: 'small' },
    },
    {
      label: 'the studio with a spacing override: the override over the app default',
      preference: { theme: 'nocturne', overrides: { spacing: 'airy' } },
      defaults: STUDIO,
      resolved: { ...NOCTURNE, spacing: 'airy', sizing: 'small' },
    },
    {
      label: 'reduced motion asked by the system: reduced over a calm override',
      preference: { overrides: { motion: 'calm' } },
      reducedMotion: true,
      resolved: { ...SAND, motion: 'reduced' },
    },
  ] satisfies {
    label: string;
    preference: Partial<AppearancePreference>;
    defaults?: TokenSetIds;
    reducedMotion?: boolean;
    resolved: Record<string, string>;
  }[])('resolves $label', ({ preference, resolved, ...options }) => {
    expect(resolvedIds(preference, options)).toEqual(resolved);
  });
});
