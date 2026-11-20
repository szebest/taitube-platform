import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { createMergeState } from '#app/features/account/api/identity-reset';
import { MergeStateContext, useMergeState } from '../merge-state.context';

describe('useMergeState', () => {
  it('answers the merge state the app layout keeps for the tab', () => {
    const state = createMergeState();

    const { result } = renderHook(useMergeState, {
      wrapper: ({ children }: PropsWithChildren) => (
        <MergeStateContext value={state}>{children}</MergeStateContext>
      ),
    });

    expect(result.current).toBe(state);
  });

  it('refuses to be read outside its context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(useMergeState)).toThrow('within MergeStateContext');
  });
});
