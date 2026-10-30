import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, apiServer, mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';

import { signedIn } from '#app/__tests__/providers';
import { VideoInspector } from '../video-inspector';

const STRANGER_ID = '0190c3a0-5e1d-7000-8000-00000000b009';

const creator = signedIn();
const stranger = signedIn(
  account({ id: STRANGER_ID, role: 'USER', user: { ...account().user, id: STRANGER_ID } })
);

async function renderInspector(Providers: ComponentType<PropsWithChildren> = creator) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <Providers>
            <VideoInspector videoId={VIDEO_ID} />
          </Providers>
        </QueryClientProvider>
      ),
    }),
    history: createMemoryHistory(),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

describe('apps/client/studio: VideoInspector', () => {
  it('shows the video, with the ways on to editing it and its analytics for its owner', async () => {
    apiServer.use(
      mockEndpoint(getVideo, () =>
        HttpResponse.json(video({ title: 'Lisbon at night', status: 'READY' }))
      )
    );
    await renderInspector();

    expect(await screen.findByRole('heading', { name: 'Lisbon at night' })).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/upload/edit/${VIDEO_ID}`
    );
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute(
      'href',
      `/videos/${VIDEO_ID}/analytics`
    );
  });

  it('offers a creator who does not own the video neither way on', async () => {
    apiServer.use(mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Not mine' }))));
    await renderInspector(stranger);

    expect(await screen.findByRole('heading', { name: 'Not mine' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
  });

  it('says so when the details did not load', async () => {
    apiServer.use(mockEndpoint(getVideo, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND)));
    await renderInspector();

    expect(await screen.findByRole('alert')).toHaveTextContent('The video details did not load.');
  });
});
