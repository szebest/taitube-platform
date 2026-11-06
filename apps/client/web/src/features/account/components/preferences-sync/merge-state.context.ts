import { createContext, use } from 'react';
import type { MergeState } from '#app/features/account/api/identity-reset';

export const MergeStateContext = createContext<MergeState | undefined>(undefined);

export function useMergeState(): MergeState {
  const value = use(MergeStateContext);
  if (value === undefined) {
    throw new Error('useMergeState must be used within PreferencesSync');
  }
  return value;
}
