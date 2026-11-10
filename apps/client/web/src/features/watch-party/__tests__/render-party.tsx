import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import type { PropsWithChildren, ReactElement } from 'react';
import { AppProviders } from '#app/__tests__/providers';

/** A viewer who holds `permissions` in the room, at `topPosition` in its hierarchy. */
export function partyViewer(
  permissions: WatchPartyViewer['permissions'],
  overrides: Partial<WatchPartyViewer> = {}
): WatchPartyViewer {
  return { permissions, topPosition: 20, isOwner: false, kind: 'user', ...overrides };
}

/** `ui` inside what the party page mounts around it: the query cache, the app's providers and the room ability. */
export function renderParty(ui: ReactElement, viewer: WatchPartyViewer = partyViewer([])) {
  const client = createQueryClient();
  const Providers = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <AppProviders>
        <IntlProvider locale="en" timeZone="UTC">
          <PartyPermissionsProvider userContext={null} viewer={viewer}>
            {children}
          </PartyPermissionsProvider>
        </IntlProvider>
      </AppProviders>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Providers });
}
