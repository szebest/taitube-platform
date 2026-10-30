import { act, renderHook } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import type { PropsWithChildren } from 'react';

import { DEFAULT_DEVICE_PREFERENCES } from '#app/features/settings/__tests__/device-preferences-fixtures';
import { PreferencesSyncContext } from '#app/features/settings/components/preferences-sync.context';
import { requestDevicePreferences } from '../device-preferences';
import {
  DevicePreferencesProvider,
  useDevicePreferences,
  usePlaybackPreference,
} from '../device-preferences-provider';

const save = vi.fn();

const wrapper = ({ children }: PropsWithChildren) => (
  <PreferencesSyncContext value={{ signedIn: true, save, notSaved: new Set() }}>
    <DevicePreferencesProvider initial={DEFAULT_DEVICE_PREFERENCES}>
      {children}
    </DevicePreferencesProvider>
  </PreferencesSyncContext>
);

const renderStore = <T,>(hook: () => T) => renderHook(hook, { wrapper });

describe('DevicePreferencesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('applies a playback change at once and keeps it in the cookie', () => {
    const { result } = renderStore(useDevicePreferences);

    act(() => result.current.setPlayback({ speed: 1.5 }));
    act(() => result.current.setPlayback({ statsOverlay: true }));

    expect(result.current.preferences.playback).toMatchObject({ speed: 1.5, statsOverlay: true });
    expect(requestDevicePreferences().playback).toMatchObject({ speed: 1.5, statsOverlay: true });
  });

  it.each([
    { label: 'moves the old key into the store', stored: 'sv-FI', expected: 'sv-FI' },
    { label: 'ignores a value that is no language tag', stored: 'x', expected: null },
  ])('$label, and removes the key', ({ stored, expected }) => {
    localStorage.setItem('vp.locale', stored);

    const { result } = renderStore(useDevicePreferences);

    expect(result.current.preferences.locale).toBe(expected);
    expect(localStorage.getItem('vp.locale')).toBeNull();
  });

  it('sets the locale on the device alone', () => {
    const { result } = renderStore(useDevicePreferences);

    act(() => result.current.setLocale('de-AT'));

    expect(requestDevicePreferences().locale).toBe('de-AT');
    expect(save).not.toHaveBeenCalled();
  });

  it('sets one playback default, here and on the account', () => {
    const { result } = renderStore(() => usePlaybackPreference('speed'));

    act(() => result.current[1](2));

    expect(result.current[0]).toBe(2);
    expect(save).toHaveBeenCalledWith({ playback: { speed: 2 } });
  });
});
