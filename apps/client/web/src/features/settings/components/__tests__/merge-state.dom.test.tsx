import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type { MergeState } from '#app/features/settings/api/identity-reset';
import { MergeStateContext, useMergeState } from '../merge-state.context';

describe('useMergeState', () => {
  it('answers the merge state of the PreferencesSync around it', () => {
    const state: MergeState = { applied: { current: undefined }, guest: { current: undefined } };

    const { result } = renderHook(useMergeState, {
      wrapper: ({ children }: PropsWithChildren) => (
        <MergeStateContext value={state}>{children}</MergeStateContext>
      ),
    });

    expect(result.current).toBe(state);
  });

  it('refuses to be read outside PreferencesSync', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(useMergeState)).toThrow('within PreferencesSync');
  });
});
