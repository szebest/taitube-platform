import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import { act, type PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { partyCookieName } from '#app/lib/preferences/party-preferences';
import { usePartyPreferences } from '../use-party-preferences';

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>{children}</AppProviders>
    </QueryClientProvider>
  );
}

function clearPartyCookie() {
  // oxlint-disable-next-line unicorn/no-document-cookie -- jsdom's jar is where the device cookie lives.
  document.cookie = `${partyCookieName}=; max-age=0; path=/`;
}

describe('apps/client/web: usePartyPreferences', () => {
  beforeEach(clearPartyCookie);

  it('starts on the defaults and keeps a change in the cookie the next first render reads', () => {
    const first = renderHook(() => usePartyPreferences(), { wrapper });
    expect(first.result.current[0].layout).toBe('side');

    act(() => first.result.current[1]({ layout: 'theater', systemLines: false }));
    first.unmount();

    const second = renderHook(() => usePartyPreferences(), { wrapper });

    expect(second.result.current[0]).toMatchObject({ layout: 'theater', systemLines: false });
  });
});
