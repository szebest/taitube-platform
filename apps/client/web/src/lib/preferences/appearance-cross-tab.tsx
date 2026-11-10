import { AppearancePreferenceSchema, useAppearance } from '@vp/ui';
import { useEffect, useEffectEvent, useRef } from 'react';
import { postPref, subscribePrefs } from './prefs-channel';

/** Keeps this tab's appearance and the other tabs' the same: the cookie raises no event, so each change is posted. */
export function AppearanceCrossTab() {
  const { preference, replace } = useAppearance();
  const lastSeen = useRef(JSON.stringify(preference));

  useEffect(() => {
    const json = JSON.stringify(preference);
    if (json === lastSeen.current) return;
    lastSeen.current = json;
    postPref({ field: 'appearance', value: preference });
  }, [preference]);

  const adopt = useEffectEvent(({ field, value }: { field: string; value: unknown }) => {
    const parsed = field === 'appearance' ? AppearancePreferenceSchema.safeParse(value) : undefined;
    if (!parsed?.success || JSON.stringify(parsed.data) === lastSeen.current) return;
    lastSeen.current = JSON.stringify(parsed.data);
    replace(parsed.data);
  });

  useEffect(() => subscribePrefs(adopt), []);

  return null;
}
