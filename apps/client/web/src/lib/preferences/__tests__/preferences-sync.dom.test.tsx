import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import {
  PreferencesSyncContext,
  useNotSaved,
  usePreferencesSync,
} from '../preferences-sync.context';

const save = vi.fn();

const wrapper = ({ children }: PropsWithChildren) => (
  <PreferencesSyncContext value={{ signedIn: true, save, notSaved: new Set(['playback.speed']) }}>
    {children}
  </PreferencesSyncContext>
);

describe('apps/client/web: preferences sync context', () => {
  it('hands a setting the sync the account holds', () => {
    const { result } = renderHook(() => usePreferencesSync(), { wrapper });

    expect(result.current.signedIn).toBe(true);
    expect(result.current.save).toBe(save);
  });

  it.each([
    { path: 'playback.speed', failed: true },
    { path: 'playback.quality', failed: false },
  ])('says whether the last save of $path failed: $failed', ({ path, failed }) => {
    const { result } = renderHook(() => useNotSaved(path), { wrapper });

    expect(result.current).toBe(failed);
  });

  it('refuses a setting rendered outside the sync', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => usePreferencesSync())).toThrow(
      'usePreferencesSync must be used within PreferencesSync'
    );
  });
});
