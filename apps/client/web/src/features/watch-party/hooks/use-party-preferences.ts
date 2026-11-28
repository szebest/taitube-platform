import { useQuery } from '@tanstack/react-query';
import type { PartyPreferences } from '@vp/domain/settings';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import {
  DEFAULT_PARTY_PREFERENCES,
  readPartyPreferences,
  writePartyPreferences,
} from '#app/lib/preferences/party-preferences';
import { preferencesQueryOptions } from '#app/lib/preferences/preferences-queries';
import { usePreferencesSync } from '#app/lib/preferences/preferences-sync.context';

/**
 * How this viewer sees a party: what this device chose (the cookie the server renders from, so the
 * first paint is already right), else what the account saved, else the defaults. A change is kept on
 * the device and, signed in, saved to the account.
 */
export function usePartyPreferences() {
  const api = useApi();
  const { signedIn, save } = usePreferencesSync();
  const { data } = useQuery({ ...preferencesQueryOptions(api), enabled: signedIn });
  const [device, setDevice] = useState(readPartyPreferences);

  const preferences: PartyPreferences = device ?? data?.party ?? DEFAULT_PARTY_PREFERENCES;

  const change = (patch: Partial<PartyPreferences>) => {
    const next = { ...preferences, ...patch };
    writePartyPreferences(next);
    setDevice(next);
    save({ party: patch });
  };

  return [preferences, change] as const;
}
