import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { getAccount } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw/http';
import type { ReactNode } from 'react';

import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { accountQueryOptions } from '#app/features/account/api/account-queries';
import { createQueryClient } from '../create-query-client';

function answerAccount(reply: () => Response): () => number {
  let asked = 0;
  apiServer.use(
    mockEndpoint(getAccount, () => {
      asked += 1;
      return reply();
    })
  );
  return () => asked;
}

async function queryAccountUntilItFails() {
  const queryClient = createQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retryDelay: 0 } });
  const { result } = renderHook(() => useQuery(accountQueryOptions()), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  await vi.waitFor(() => expect(result.current.isError).toBe(true));
}

describe('apps/client/web: createQueryClient in the browser', () => {
  it.each([
    { failure: 'a 401', reply: () => problemReply(ErrorCodes.UNAUTHORIZED), requests: 1 },
    { failure: 'a 404', reply: () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND), requests: 1 },
    { failure: 'a 503', reply: () => problemReply(ErrorCodes.INTERNAL, 503), requests: 4 },
    { failure: 'a dropped connection', reply: () => HttpResponse.error(), requests: 4 },
  ])('asks $requests time(s) for a query that fails with $failure', async ({ reply, requests }) => {
    const asked = answerAccount(reply);

    await queryAccountUntilItFails();

    expect(asked()).toBe(requests);
  });
});
