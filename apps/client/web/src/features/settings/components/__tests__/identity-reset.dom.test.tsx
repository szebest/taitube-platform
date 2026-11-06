import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { AppearanceProvider, requestAppearancePreference, writeCookie } from '@vp/ui';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/features/settings/__tests__/device-preferences-fixtures';
import type { MergeState } from '#app/features/settings/api/identity-reset';
import { DevicePreferencesProvider } from '#app/features/settings/device/device-preferences-provider';
import { IdentityReset } from '../identity-reset';
import { MergeStateContext } from '../merge-state.context';

function renderReset(userId: string | undefined) {
  const merge: MergeState = {
    applied: { current: { userId: 'ada', version: 4 } },
    guest: { current: undefined },
  };
  const tree = (id: string | undefined) => (
    <QueryClientProvider client={new QueryClient()}>
      <MergeStateContext value={merge}>
        <AppearanceProvider stored={requestAppearancePreference()}>
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

    rerenderAs(to);

    expect(merge.applied.current).toEqual({ userId: 'ada', version: 4 });
  });

  it('resets the merge state when the user signs out', () => {
    const { merge, rerenderAs } = renderReset('ada');

    rerenderAs(undefined);

    expect(merge.applied.current).toBeUndefined();
  });
});
