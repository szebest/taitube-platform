import type { TokenGroup, TokenSet } from '@kit/design-tokens';
import { useAppearance } from '@kit/ui';
import { appearance } from '@kit/ui/appearance/registry';

/**
 * One token group as the viewer has it: the sets offered, the default a reset returns to, and the
 * choice made. The advanced and accessibility pages both write through it, so they never disagree.
 */
export function useTokenOverride(group: TokenGroup) {
  const { preference, resolved, appDefaults, setOverride, resetOverrides } = useAppearance();

  const sets: readonly TokenSet[] = appearance.offer[group];
  const defaultSet =
    sets.find(({ id }) => id === appDefaults[group]) ?? resolved.theme.defaults[group];
  const stored = preference.overrides[group];

  return {
    sets,
    defaultSet,
    override: sets.some(({ id }) => id === stored) ? stored : undefined,
    shown: resolved.sets[group],
    choose: (id: string) => setOverride(group, id),
    reset: () => resetOverrides(group),
  };
}
