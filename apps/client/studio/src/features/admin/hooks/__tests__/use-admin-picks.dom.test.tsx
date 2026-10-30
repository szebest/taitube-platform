import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listAdminPicks } from '@vp/api-contracts';
import { ApiProvider, createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { adminPick } from '#app/features/admin/components/__tests__/picks.fixture';
import { useAdminPicks } from '../use-admin-picks';

const PICK = adminPick();

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('apps/client/studio: useAdminPicks', () => {
  it('reads the scheduled picks', async () => {
    apiServer.use(mockEndpoint(listAdminPicks, () => HttpResponse.json({ items: [PICK] })));

    const { result } = renderHook(useAdminPicks, { wrapper: Providers });

    await waitFor(() => expect(result.current.data).toEqual([PICK]));
  });
});
