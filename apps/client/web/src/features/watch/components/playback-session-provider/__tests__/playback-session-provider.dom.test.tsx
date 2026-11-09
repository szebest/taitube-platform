import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { SessionProvider } from '@vp/queries';
import { account, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { act, useEffect } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { usePlaybackQueue } from '#app/hooks/use-playback-queue';
import { PlaybackSessionProvider } from '../playback-session-provider';

const seen: { queue?: ReturnType<typeof usePlaybackQueue> } = {};

function Probe() {
  const queue = usePlaybackQueue();
  useEffect(() => {
    seen.queue = queue;
  });
  return null;
}

describe('apps/client/web: playback session provider', () => {
  it('starts another account with an empty queue', async () => {
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => (
          <PlaybackSessionProvider>
            <Probe />
          </PlaybackSessionProvider>
        ),
      }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    const tree = (viewer: ReturnType<typeof account>) => (
      <AppProviders>
        <SessionProvider session={{ status: 'signed-in', account: viewer }}>
          <RouterProvider router={router} />
        </SessionProvider>
      </AppProviders>
    );
    const first = account();
    const { rerender } = render(tree(first));
    await act(async () => seen.queue?.append(videoSummary({ id: VIDEO_ID })));
    expect(seen.queue?.videos).toHaveLength(1);

    rerender(tree({ ...first, id: '0190c3a0-5e1d-7000-8000-00000000f001' }));

    expect(seen.queue?.videos).toHaveLength(0);
  });
});
