import { useAppearance } from './provider';

const COMPACT = { spacing: 'compact', sizing: 'small' } as const;

export const DENSITIES = ['comfortable', 'compact'] as const;

export type Density = (typeof DENSITIES)[number];

/** The simple density control: compact is compact spacing with small sizing, comfortable is the theme's own. */
export function useDensity() {
  const { resolved, setOverride, resetOverrides, appDefaults } = useAppearance();

  const density: Density =
    resolved.sets.spacing.id === COMPACT.spacing && resolved.sets.sizing.id === COMPACT.sizing
      ? 'compact'
      : 'comfortable';

  const setDensity = (picked: Density) => {
    for (const group of ['spacing', 'sizing'] as const) {
      if (picked === 'compact') {
        setOverride(group, COMPACT[group]);
      } else if (appDefaults[group] === undefined) {
        resetOverrides(group);
      } else {
        // An app that starts compact (the studio) would come back compact from a reset.
        setOverride(group, resolved.theme.defaults[group].id);
      }
    }
  };

  return { density, setDensity };
}
