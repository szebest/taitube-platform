import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import {
  AppearanceProvider,
  requestAppearancePreference,
  useAppearance,
  writeCookie,
} from '@vp/ui';
import type { PropsWithChildren } from 'react';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/features/settings/__tests__/device-preferences-fixtures';
import { preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import type { MergeState } from '#app/features/settings/api/identity-reset';
import { MergeStateContext } from '#app/features/settings/components/merge-state.context';
import { PreferencesSyncContext } from '#app/features/settings/components/preferences-sync.context';
import {
  DevicePreferencesProvider,
  useDevicePreferences,
} from '#app/features/settings/device/device-preferences-provider';
import { useResetIdentity } from '../use-reset-identity';

const GUEST_PLAYBACK = { ...DEFAULT_PREFERENCES.playback, speed: 1.5 } as const;
const OLD_ACCOUNT_PLAYBACK = { ...DEFAULT_PREFERENCES.playback, speed: 2 } as const;

function renderReset() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['preferences'], preferencesView({ version: 4 }));
  const merge: MergeState = {
    applied: { current: { userId: 'old', version: 4 } },
    guest: { current: undefined },
  };
  const hook = renderHook(
    () => ({
      reset: useResetIdentity(),
      device: useDevicePreferences(),
      appearance: useAppearance(),
    }),
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <PreferencesSyncContext value={{ signedIn: true, save: vi.fn(), notSaved: new Set() }}>
            <MergeStateContext value={merge}>
              <AppearanceProvider stored={requestAppearancePreference()}>
                <DevicePreferencesProvider initial={DEFAULT_DEVICE_PREFERENCES}>
                  {children}
                </DevicePreferencesProvider>
              </AppearanceProvider>
            </MergeStateContext>
          </PreferencesSyncContext>
        </QueryClientProvider>
      ),
    }
  );
  return { ...hook, queryClient, merge };
}

describe('useResetIdentity', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it("drops the old account's cached preferences and puts the guest's playback back on the device", () => {
    const { result, queryClient, merge } = renderReset();
    merge.guest.current = {
      appearance: result.current.appearance.preference,
      playback: GUEST_PLAYBACK,
    };
    act(() => result.current.device.replacePlayback(OLD_ACCOUNT_PLAYBACK));

    act(() => result.current.reset());

    expect(queryClient.getQueryData(['preferences'])).toBeUndefined();
    expect(result.current.device.preferences.playback).toEqual(GUEST_PLAYBACK);
    expect(merge.applied.current).toBeUndefined();
  });
});
