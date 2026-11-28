import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { listWatchPartyControls, type PersonalControlView } from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import { IntlProvider } from '@vp/queries/intl';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren, ReactElement } from 'react';
import { AppProvidersWithToasts } from '#app/__tests__/providers';
import { WEB_MESSAGES } from '#app/lib/messages';

/** A viewer who holds `permissions` in the room, at `topPosition` in its hierarchy. */
export function partyViewer(
  permissions: WatchPartyViewer['permissions'],
  overrides: Partial<WatchPartyViewer> = {}
): WatchPartyViewer {
  return { permissions, topPosition: 20, isOwner: false, kind: 'user', ...overrides };
}

/** `ui` inside what the party page mounts around it: the query cache, the app's providers with toasts and the room ability, and `controls` as the viewer's saved personal controls. */
export function renderParty(
  ui: ReactElement,
  viewer: WatchPartyViewer = partyViewer([]),
  controls: PersonalControlView[] = []
) {
  apiServer.use(mockEndpoint(listWatchPartyControls, () => HttpResponse.json({ items: controls })));
  const client = createQueryClient();
  const Providers = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <AppProvidersWithToasts>
        <IntlProvider messages={WEB_MESSAGES} locale="en" timeZone="UTC">
          <PartyPermissionsProvider userContext={null} viewer={viewer}>
            {children}
          </PartyPermissionsProvider>
        </IntlProvider>
      </AppProvidersWithToasts>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Providers });
}
