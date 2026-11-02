import { QueryClient } from '@tanstack/react-query';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { DEFAULT_APPEARANCE } from '@vp/ui';

import { preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { type MergeState, resetIdentityState } from '../identity-reset';

const GUEST = { appearance: DEFAULT_APPEARANCE, playback: DEFAULT_PREFERENCES.playback };

function setup(merge: Partial<{ [K in keyof MergeState]: MergeState[K]['current'] }> = {}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['preferences'], preferencesView({ version: 4 }));
  queryClient.setQueryData(['feed'], ['kept']);
  const state: MergeState = {
    applied: { current: merge.applied ?? { userId: 'old', version: 4 } },
    guest: { current: merge.guest },
  };
  const restoreGuest = vi.fn();
  return {
    queryClient,
    state,
    restoreGuest,
    reset: () => resetIdentityState(queryClient, state, restoreGuest),
  };
}

describe('resetIdentityState', () => {
  it('removes the preferences query so the new identity never renders the old settings', () => {
    const { queryClient, reset } = setup();

    reset();

    expect(queryClient.getQueryData(['preferences'])).toBeUndefined();
    expect(queryClient.getQueryData(['feed'])).toEqual(['kept']);
  });

  it('forgets the merged version and the guest sections, so the next sign-in merges as a first one', () => {
    const { state, reset } = setup({ guest: GUEST });

    reset();

    expect(state.applied.current).toBeUndefined();
    expect(state.guest.current).toBeUndefined();
  });

  it("puts the guest's sections back on the device before forgetting them", () => {
    const { restoreGuest, reset } = setup({ guest: GUEST });

    reset();

    expect(restoreGuest).toHaveBeenCalledWith(GUEST);
  });

  it('restores nothing when no merge ever captured the guest', () => {
    const { restoreGuest, reset } = setup();

    reset();

    expect(restoreGuest).not.toHaveBeenCalled();
  });
});
