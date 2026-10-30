import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listAdminCategories } from '@vp/api-contracts';
import { ApiProvider, createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { adminCategory } from '#app/features/admin/components/__tests__/categories.fixture';
import { useAdminCategories } from '../use-admin-categories';

const MUSIC = adminCategory({ videoCount: 2 });

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('apps/client/studio: useAdminCategories', () => {
  it('reads every category with its video count', async () => {
    apiServer.use(mockEndpoint(listAdminCategories, () => HttpResponse.json([MUSIC])));

    const { result } = renderHook(useAdminCategories, { wrapper: Providers });

    await waitFor(() => expect(result.current.data).toEqual([MUSIC]));
  });
});
