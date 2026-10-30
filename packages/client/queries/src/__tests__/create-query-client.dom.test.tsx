import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { api, apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ReactNode } from 'react';

import { createQueryClient } from '../create-query-client';
import { videoQueryOptions } from '../video-queries';

function answerVideo(reply: () => Response): () => number {
  let asked = 0;
  apiServer.use(
    mockEndpoint(getVideo, () => {
      asked += 1;
      return reply();
    })
  );
  return () => asked;
}

async function queryVideoUntilItFails() {
  const queryClient = createQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retryDelay: 0 } });
  const { result } = renderHook(() => useQuery(videoQueryOptions(api, VIDEO_ID)), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  await vi.waitFor(() => expect(result.current.isError).toBe(true));
}

describe('@vp/queries: createQueryClient in the browser', () => {
  it.each([
    { failure: 'a 401', reply: () => problemReply(ErrorCodes.UNAUTHORIZED), requests: 1 },
    { failure: 'a 404', reply: () => problemReply(ErrorCodes.VIDEO_NOT_FOUND), requests: 1 },
    { failure: 'a 503', reply: () => problemReply(ErrorCodes.INTERNAL, 503), requests: 4 },
    { failure: 'a dropped connection', reply: () => HttpResponse.error(), requests: 4 },
  ])('asks $requests time(s) for a query that fails with $failure', async ({ reply, requests }) => {
    const asked = answerVideo(reply);

    await queryVideoUntilItFails();

    expect(asked()).toBe(requests);
  });
});
