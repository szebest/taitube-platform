import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, waitFor } from '@testing-library/react';
import { putRecommendationFeedback } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { createToaster, ToastProvider } from '@vp/ui';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { CHANNELS, IDS } from '#app/__tests__/recommendation-fixtures';
import {
  type RecommendationFeedbackActions,
  useRecommendationFeedback,
} from '../use-recommendation-feedback';

async function renderFeedback(Viewer: ComponentType<PropsWithChildren>) {
  const bodies: unknown[] = [];
  apiServer.use(
    mockEndpoint(putRecommendationFeedback, async ({ request }) => {
      bodies.push(await request.clone().json());
      return new HttpResponse(null, { status: 500 });
    })
  );
  const seen: { actions?: RecommendationFeedbackActions } = {};
  const Probe = () => {
    seen.actions = useRecommendationFeedback();
    return null;
  };
  const router = createRouter({
    routeTree: createRootRoute({ component: Probe }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Viewer>
        <ToastProvider toaster={createToaster()}>
          <RouterProvider router={router} />
        </ToastProvider>
      </Viewer>
    </QueryClientProvider>
  );

  return { bodies, router, actions: () => seen.actions as RecommendationFeedbackActions };
}

describe('apps/client/web: useRecommendationFeedback', () => {
  it.each([
    {
      action: 'hideVideo',
      call: (actions: RecommendationFeedbackActions) => actions.hideVideo(IDS.night),
      sent: { kind: 'not_interested', videoId: IDS.night },
    },
    {
      action: 'hideChannel',
      call: (actions: RecommendationFeedbackActions) => actions.hideChannel(CHANNELS.lisbon.id),
      sent: { kind: 'hide_channel', channelId: CHANNELS.lisbon.id },
    },
  ])('sends the tagged body for $action', async ({ call, sent }) => {
    const { bodies, actions } = await renderFeedback(signedIn());

    call(actions());

    await waitFor(() => expect(bodies).toEqual([sent]));
  });

  it('sends a guest to the sign-in prompt and writes nothing', async () => {
    const { bodies, router, actions } = await renderFeedback(AppProviders);

    actions().hideVideo(IDS.night);

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ modal: 'sign-in', reason: 'feedback' })
    );
    expect(bodies).toEqual([]);
  });
});
