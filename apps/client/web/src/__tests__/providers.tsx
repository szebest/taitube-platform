import type { Account } from '@vp/api-contracts';
import { getAccount, getPreferences } from '@vp/api-contracts';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import {
  ApiProvider,
  AppWords,
  GUEST,
  SESSION_COOKIE,
  type Session,
  SessionProvider,
} from '@vp/queries';
import { DEV_TOKEN_URL } from '@vp/queries/dev-personas';
import { Tooltip } from '@vp/ui';
import { account, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse, http } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/features/settings/__tests__/device-preferences-fixtures';
import { PreferencesSyncContext } from '#app/features/settings/components/preferences-sync.context';
import { DevicePreferencesProvider } from '#app/features/settings/device/device-preferences-provider';

const NO_SYNC = { signedIn: false, save: () => {}, notSaved: new Set<string>() };

function providersFor(session: Session): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <AppWords>
      <ApiProvider api={api}>
        <SessionProvider session={session}>
          <DevicePreferencesProvider initial={DEFAULT_DEVICE_PREFERENCES}>
            <PreferencesSyncContext value={NO_SYNC}>
              <Tooltip.Provider>{children}</Tooltip.Provider>
            </PreferencesSyncContext>
          </DevicePreferencesProvider>
        </SessionProvider>
      </ApiProvider>
    </AppWords>
  );
}

/** What the root route mounts around every page for a guest, in a fixed locale and zone. */
export const AppProviders = providersFor(GUEST);

/** The same, for `viewer` signed in. */
export function signedIn(viewer: Account = account()): ComponentType<PropsWithChildren> {
  return providersFor({ status: 'signed-in', account: viewer });
}

/** The app's providers with the permissions of `viewer` in place of the session's. */
export function asViewer(viewer: UserContext | null): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <AppProviders>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </AppProviders>
  );
}

/** The session cookie of a signed-in browser, as a request carries it. */
export const SESSION = `${SESSION_COOKIE}=signed-in`;

/** Signs this jsdom browser in as `viewer`: the session cookie, and the API naming them and holding no saved preferences. */
export function signInBrowser(viewer: Account = account()) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom's jar is where the session cookie lives.
  document.cookie = `${SESSION}; path=/`;
  apiServer.use(
    mockEndpoint(getPreferences, () =>
      HttpResponse.json({
        appearance: null,
        playback: null,
        privacy: null,
        notifications: null,
        version: 0,
        updatedAt: null,
      })
    )
  );
  return mockEndpoint(getAccount, () => HttpResponse.json(viewer));
}

/** `dev-token serve` on this machine, minting the token of whichever persona is asked for. */
export function devTokenServe() {
  return http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
    HttpResponse.json({ token: `token-of-${new URL(request.url).searchParams.get('persona')}` })
  );
}
