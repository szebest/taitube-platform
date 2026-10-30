import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { apiServer } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { holds, preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { PreferencesSyncContext } from '#app/features/settings/components/preferences-sync.context';
import { useAccountPreference } from '../use-account-preference';

const PAUSED = { ...DEFAULT_PREFERENCES.privacy, historyPaused: true };

function renderPreference(Session: ComponentType<PropsWithChildren>, save = vi.fn()) {
  const client = new QueryClient();
  const hook = renderHook(() => useAccountPreference('privacy', 'historyPaused'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <Session>
          <PreferencesSyncContext
            value={{ signedIn: Session !== AppProviders, save, notSaved: new Set() }}
          >
            {children}
          </PreferencesSyncContext>
        </Session>
      </QueryClientProvider>
    ),
  });
  return { ...hook, save };
}

describe('useAccountPreference', () => {
  it('reads the saved value, once the account has been asked', async () => {
    apiServer.use(holds(preferencesView({ version: 1, privacy: PAUSED })));
    const { result } = renderPreference(signedIn());

    expect(result.current[0]).toBe(false);
    await waitFor(() => expect(result.current[0]).toBe(true));
  });

  it('is the default for a guest, and for a section the account never saved', async () => {
    const { result } = renderPreference(AppProviders);

    expect(result.current[0]).toBe(false);
  });

  it('saves the one field that changed', () => {
    const { result, save } = renderPreference(signedIn());

    act(() => result.current[1](true));

    expect(save).toHaveBeenCalledWith({ privacy: { historyPaused: true } });
  });
});
