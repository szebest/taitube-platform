import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { videoSummary } from '@vp/web-testing';
import { PlaybackSessionStub } from '#app/__tests__/playback-session-stub';
import { AppProviders } from '#app/__tests__/providers';
import { usePlaybackQueue } from '../use-playback-queue';

const first = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c001', title: 'a' });
const second = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c002', title: 'b' });

async function renderQueue() {
  const seen: { queue?: ReturnType<typeof usePlaybackQueue> } = {};
  const Probe = () => {
    seen.queue = usePlaybackQueue();
    return null;
  };
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <PlaybackSessionStub>
          <Probe />
        </PlaybackSessionStub>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return () => seen.queue as ReturnType<typeof usePlaybackQueue>;
}

describe('apps/client/web: usePlaybackQueue', () => {
  it('queues videos, reorders and removes them, and answers what comes next', async () => {
    const queue = await renderQueue();

    await act(async () => queue().append(first));
    await act(async () => queue().append(second));
    await act(async () => queue().go(first));
    expect(queue().next()?.title).toBe('b');

    await act(async () => queue().reorder(second.id, 0));
    expect(queue().videos.map(({ title }) => title)).toEqual(['b', 'a']);
    expect(queue().next()).toBeUndefined();

    await act(async () => queue().remove(second.id));
    expect(queue().videos.map(({ title }) => title)).toEqual(['a']);
  });

  it('plays and pauses the video it goes to, and stops it on close', async () => {
    const queue = await renderQueue();

    await act(async () => queue().go(first));
    expect(queue().paused).toBe(false);
    await act(async () => queue().setPaused(true));
    expect(queue().paused).toBe(true);

    await act(async () => queue().close());
    expect(queue().current).toBeUndefined();
  });
});
