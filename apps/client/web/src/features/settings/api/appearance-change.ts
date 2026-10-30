import type { AppearancePreference } from '@vp/ui';
import { accountAppearance } from '@vp/ui';

import type { PreferencesChange } from './preferences-change';

type Appearance = NonNullable<PreferencesChange['appearance']>;

const AXES = ['theme', 'mode', 'accent', 'contrast'] as const;

/** What saving `to` after `from` sends the account, or nothing when the two read the same. */
export function appearanceChange(
  from: AppearancePreference,
  to: AppearancePreference
): PreferencesChange | undefined {
  const before = accountAppearance(from);
  const after = accountAppearance(to);

  const axes = AXES.filter((axis) => before[axis] !== after[axis]).map((axis) => [
    axis,
    after[axis],
  ]);
  const groups = [...new Set([...Object.keys(before.overrides), ...Object.keys(after.overrides)])]
    .filter((group) => before.overrides[group] !== after.overrides[group])
    .map((group) => [group, after.overrides[group] ?? null]);

  if (axes.length === 0 && groups.length === 0) return undefined;

  const appearance: Appearance = {
    ...Object.fromEntries(axes),
    ...(groups.length > 0 && { overrides: Object.fromEntries(groups) }),
  };
  return { appearance };
}
