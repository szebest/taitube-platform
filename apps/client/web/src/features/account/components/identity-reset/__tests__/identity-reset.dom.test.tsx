import { AppearanceProvider, requestAppearancePreference, writeCookie } from '@kit/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { APPEARANCE_COOKIES } from '@vp/domain/settings';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/__tests__/device-preferences-fixtures';
import type { MergeState } from '#app/features/account/api/identity-reset';
import { MergeStateContext } from '#app/features/account/components/preferences-sync/merge-state.context';
import { DevicePreferencesProvider } from '#app/lib/preferences/device-preferences-provider';
import { IdentityReset } from '../identity-reset';

function renderReset(
  userId: string | undefined,
  applied: MergeState['applied']['current'] = userId ? { userId, version: 4 } : undefined
) {
  const merge: MergeState = {
    applied: { current: applied },
    guest: { current: undefined },
    baseline: { current: undefined },
  };
  const tree = (id: string | undefined) => (
    <QueryClientProvider client={new QueryClient()}>
      <MergeStateContext value={merge}>
        <AppearanceProvider stored={requestAppearancePreference(APPEARANCE_COOKIES)}>
          <DevicePreferencesProvider initial={DEFAULT_DEVICE_PREFERENCES}>
            <IdentityReset userId={id} />
          </DevicePreferencesProvider>
        </AppearanceProvider>
      </MergeStateContext>
    </QueryClientProvider>
  );
  const view = render(tree(userId));
  return { merge, rerenderAs: (id: string | undefined) => view.rerender(tree(id)) };
}

describe('IdentityReset', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('leaves the merge state alone on the first render', () => {
    const { merge } = renderReset('ada');

    expect(merge.applied.current).toEqual({ userId: 'ada', version: 4 });
  });

  it('leaves the merge state alone while the user stays the same', () => {
    const { merge, rerenderAs } = renderReset('ada');

    rerenderAs('ada');

    expect(merge.applied.current).toEqual({ userId: 'ada', version: 4 });
  });

  it.each([
    { name: 'the user changes', from: 'ada', to: 'grace' },
    { name: 'a guest signs in', from: undefined, to: 'grace' },
  ])('leaves the merge state alone when $name', ({ from, to }) => {
    const { merge, rerenderAs } = renderReset(from);
    const before = merge.applied.current;

    rerenderAs(to);

    expect(merge.applied.current).toEqual(before);
  });

  it('resets the merge state when the user signs out', () => {
    const { merge, rerenderAs } = renderReset('ada');

    rerenderAs(undefined);

    expect(merge.applied.current).toBeUndefined();
  });

  it('resets the merge state when the tree mounts again signed out after an account was merged', () => {
    const { merge } = renderReset(undefined, { userId: 'ada', version: 4 });

    expect(merge.applied.current).toBeUndefined();
  });
});
