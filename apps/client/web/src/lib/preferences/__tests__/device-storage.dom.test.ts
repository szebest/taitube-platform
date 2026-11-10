import { writeCookie } from '@vp/ui';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/__tests__/device-preferences-fixtures';
import {
  adoptLegacyPlayback,
  readStoredPlayback,
  requestDevicePreferences,
  saveDeviceLocale,
  saveStoredPlayback,
  STORAGE_PLAYBACK_KEY,
} from '../device-preferences';

const DEFAULT_PLAYBACK = DEFAULT_DEVICE_PREFERENCES.playback;

const cookie = (value: unknown) => writeCookie('vp.device', JSON.stringify(value), { maxAge: 60 });

describe('apps/client/web: the device preferences in the browser', () => {
  afterEach(() => {
    localStorage.clear();
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('keeps the playback fields in localStorage, and the others as they were', () => {
    saveStoredPlayback({ speed: 1.5 });
    saveStoredPlayback({ autoplayNext: false });

    expect(readStoredPlayback()).toEqual({ ...DEFAULT_PLAYBACK, speed: 1.5, autoplayNext: false });
    expect(JSON.parse(localStorage.getItem(STORAGE_PLAYBACK_KEY) ?? '')).toMatchObject({
      schema: 1,
    });
  });

  it('merges a write over what is stored now, so a stale page cannot overwrite another tab', () => {
    saveStoredPlayback({ speed: 1.5 });
    const staleTab = { statsOverlay: true };
    localStorage.setItem(
      STORAGE_PLAYBACK_KEY,
      JSON.stringify({ schema: 1, playback: { ...DEFAULT_PLAYBACK, speed: 2 } })
    );

    expect(saveStoredPlayback(staleTab)).toEqual({
      ...DEFAULT_PLAYBACK,
      speed: 2,
      statsOverlay: true,
    });
  });

  it.each([
    { label: 'a field that is not a choice', playback: { speed: 9, quality: '720p' } },
    { label: 'a field of the wrong type', playback: { speed: '1.5', quality: '720p' } },
  ])('falls back for $label alone, never for the whole store', ({ playback }) => {
    localStorage.setItem(STORAGE_PLAYBACK_KEY, JSON.stringify({ schema: 1, playback }));

    expect(readStoredPlayback()).toEqual({ ...DEFAULT_PLAYBACK, quality: '720p' });
  });

  it.each(['{', '"text"', 'null'])('reads damaged storage %s as the defaults', (raw) => {
    localStorage.setItem(STORAGE_PLAYBACK_KEY, raw);

    expect(readStoredPlayback()).toEqual(DEFAULT_PLAYBACK);
  });

  it('reads the fields it knows from a newer version, and does not downgrade the version it wrote', () => {
    localStorage.setItem(
      STORAGE_PLAYBACK_KEY,
      JSON.stringify({ schema: 7, playback: { speed: 1.5 }, ahead: true })
    );

    expect(readStoredPlayback().speed).toBe(1.5);
    saveStoredPlayback({ statsOverlay: true });
    expect(JSON.parse(localStorage.getItem(STORAGE_PLAYBACK_KEY) ?? '')).toMatchObject({
      schema: 1,
      ahead: true,
    });
  });

  it('writes the locale over the cookie as it is now', () => {
    cookie({ schema: 2, locale: 'sv-FI', other: 'kept' });

    saveDeviceLocale('de-AT');

    expect(requestDevicePreferences().locale).toBe('de-AT');
    expect(document.cookie).toContain(encodeURIComponent('"other":"kept"'));
  });

  it('moves the playback of a version 1 cookie into storage once, and rewrites the cookie without it', () => {
    cookie({ schema: 1, playback: { speed: 1.5 }, locale: 'sv-FI' });

    expect(adoptLegacyPlayback()).toEqual({ ...DEFAULT_PLAYBACK, speed: 1.5 });
    expect(readStoredPlayback().speed).toBe(1.5);
    expect(requestDevicePreferences().locale).toBe('sv-FI');
    expect(document.cookie).not.toContain('playback');
    expect(adoptLegacyPlayback()).toBeUndefined();
  });

  it('keeps what storage already holds over the playback of an old cookie', () => {
    saveStoredPlayback({ speed: 2 });
    cookie({ schema: 1, playback: { speed: 1.5 }, locale: null });

    expect(adoptLegacyPlayback()).toBeUndefined();
    expect(readStoredPlayback().speed).toBe(2);
  });

  it('reads and writes nothing when storage refuses, and does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(saveStoredPlayback({ speed: 1.5 }).speed).toBe(1.5);
    expect(readStoredPlayback()).toEqual(DEFAULT_PLAYBACK);
  });
});
