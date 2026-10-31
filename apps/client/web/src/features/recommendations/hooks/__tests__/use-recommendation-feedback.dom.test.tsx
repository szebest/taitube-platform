import { renderHook, waitFor } from '@testing-library/react';
import { putRecommendationFeedback } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { createToaster, ToastProvider } from '@vp/ui';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { CHANNELS, IDS } from '#app/features/recommendations/__tests__/recommendation-fixtures';
import { useRecommendationFeedback } from '../use-recommendation-feedback';

describe('apps/client/web: useRecommendationFeedback', () => {
  it.each([
    {
      action: 'hideVideo',
      call: (actions: ReturnType<typeof useRecommendationFeedback>) => actions.hideVideo(IDS.night),
      sent: { kind: 'not_interested', videoId: IDS.night },
    },
    {
      action: 'hideChannel',
      call: (actions: ReturnType<typeof useRecommendationFeedback>) =>
        actions.hideChannel(CHANNELS.lisbon.id),
      sent: { kind: 'hide_channel', channelId: CHANNELS.lisbon.id },
    },
  ])('sends the tagged body for $action', async ({ call, sent }) => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(putRecommendationFeedback, async ({ request }) => {
        bodies.push(await request.clone().json());
        return new HttpResponse(null, { status: 500 });
      })
    );
    const client = createQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <AppProviders>
          <ToastProvider toaster={createToaster()}>{children}</ToastProvider>
        </AppProviders>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useRecommendationFeedback(), { wrapper });

    call(result.current);

    await waitFor(() => expect(bodies).toEqual([sent]));
  });
});
