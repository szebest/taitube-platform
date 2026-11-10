import { COMPACT, type Density, densityOf } from './density';
import { useAppearance } from './provider';

export { DENSITIES, type Density } from './density';

/** The simple density control: compact is compact spacing with small sizing, comfortable is the theme's own. */
export function useDensity() {
  const { resolved, setOverride, resetOverrides, appDefaults } = useAppearance();

  const density = densityOf(resolved.sets);

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
