import { act, renderHook } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import type { PropsWithChildren } from 'react';
import { renderToString } from 'react-dom/server';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/__tests__/device-preferences-fixtures';
import {
  readStoredPlayback,
  requestDevicePreferences,
  saveStoredPlayback,
} from '../device-preferences';
import {
  DevicePreferencesProvider,
  useDevicePreferences,
  useLocalePreference,
  usePlaybackPreference,
} from '../device-preferences-provider';
import { PreferencesSyncContext } from '../preferences-sync.context';

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
    localStorage.clear();
  });

  it('applies a playback change at once and keeps it in the cookie', () => {
    const { result } = renderStore(useDevicePreferences);

    act(() => result.current.setPlayback({ speed: 1.5 }));
    act(() => result.current.setPlayback({ statsOverlay: true }));

    expect(result.current.preferences.playback).toMatchObject({ speed: 1.5, statsOverlay: true });
    expect(readStoredPlayback()).toMatchObject({ speed: 1.5, statsOverlay: true });
  });

  it.each([
    { label: 'moves the old key into the store', stored: 'sv-FI', expected: 'sv-FI' },
    { label: 'ignores a value that is no language tag', stored: 'x', expected: null },
  ])('$label, and removes the key', ({ stored, expected }) => {
    localStorage.setItem('vp.locale', stored);

    const { result } = renderStore(useLocalePreference);

    expect(result.current[0]).toBe(expected);
    expect(localStorage.getItem('vp.locale')).toBeNull();
  });

  it('sets the locale on the device alone', () => {
    const { result } = renderStore(useLocalePreference);

    act(() => result.current[1]('de-AT'));

    expect(requestDevicePreferences().locale).toBe('de-AT');
    expect(save).not.toHaveBeenCalled();
  });

  it('sets one playback default, here and on the account', () => {
    const { result } = renderStore(() => usePlaybackPreference('speed'));

    act(() => result.current[1](2));

    expect(result.current[0]).toBe(2);
    expect(save).toHaveBeenCalledWith({ playback: { speed: 2 } });
  });

  it('renders a stored playback field as its default on the server, and takes the stored value once mounted', () => {
    saveStoredPlayback({ speed: 1.5 });
    const Speed = () => <p>{usePlaybackPreference('speed')[0]}</p>;
    const tree = (
      <PreferencesSyncContext value={{ signedIn: false, save, notSaved: new Set() }}>
        <DevicePreferencesProvider initial={DEFAULT_DEVICE_PREFERENCES}>
          <Speed />
        </DevicePreferencesProvider>
      </PreferencesSyncContext>
    );

    expect(renderToString(tree)).toContain('<p>1</p>');
    const { result } = renderStore(() => usePlaybackPreference('speed'));
    expect(result.current[0]).toBe(1.5);
  });

  it('writes over what storage holds now, so a stale tab cannot undo another tab', () => {
    const { result } = renderStore(useDevicePreferences);
    saveStoredPlayback({ speed: 2 });

    act(() => result.current.setPlayback({ statsOverlay: true }));

    expect(readStoredPlayback()).toMatchObject({ speed: 2, statsOverlay: true });
  });

  it('follows another tab: a playback field it posted, and a locale it set', async () => {
    const otherTab = new BroadcastChannel('vp.prefs');
    const { result } = renderStore(useDevicePreferences);

    saveStoredPlayback({ speed: 2 });
    otherTab.postMessage({ field: 'playback.speed', value: 2 });
    await vi.waitFor(() => expect(result.current.preferences.playback.speed).toBe(2));

    writeCookie('vp.device', JSON.stringify({ schema: 2, locale: 'sv-FI' }), { maxAge: 60 });
    otherTab.postMessage({ field: 'locale', value: 'sv-FI' });
    await vi.waitFor(() => expect(result.current.preferences.locale).toBe('sv-FI'));
    otherTab.close();
  });

  it('tells the other tabs which field it changed', async () => {
    const otherTab = new BroadcastChannel('vp.prefs');
    const heard: unknown[] = [];
    otherTab.onmessage = ({ data }) => heard.push(data);
    const { result } = renderStore(useDevicePreferences);

    act(() => result.current.setPlayback({ speed: 1.5 }));
    act(() => result.current.setLocale('de-AT'));

    await vi.waitFor(() =>
      expect(heard).toEqual([
        { field: 'playback.speed', value: 1.5 },
        { field: 'locale', value: 'de-AT' },
      ])
    );
    otherTab.close();
  });
});
