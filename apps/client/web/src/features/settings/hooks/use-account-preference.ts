import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { useApi } from '@vp/queries';

import { preferencesQueryOptions } from '../api/preferences-queries';
import { usePreferencesSync } from '../components/preferences-sync.context';

type AccountOnlySection = 'privacy' | 'notifications';

type SectionValues<S extends AccountOnlySection> = (typeof DEFAULT_PREFERENCES)[S];

/**
 * A setting only the account holds, such as `privacy.historyPaused`: the saved value, or its
 * default until the account saves one. A guest has none to change, so `set` does nothing for them.
 */
export function useAccountPreference<
  S extends AccountOnlySection,
  K extends keyof SectionValues<S>,
>(section: S, key: K): readonly [SectionValues<S>[K], (value: SectionValues<S>[K]) => void] {
  const api = useApi();
  const { signedIn, save } = usePreferencesSync();
  const { data } = useQuery({ ...preferencesQueryOptions(api), enabled: signedIn });

  const saved = data?.[section] as SectionValues<S> | null | undefined;
  const set = (value: SectionValues<S>[K]) => save({ [section]: { [key]: value } });

  return [(saved ?? DEFAULT_PREFERENCES[section])[key], set];
}
