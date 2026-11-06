import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { VIDEO_ID, videoSummary } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { PlaybackSessionProvider } from '#app/features/watch/components/playback-session-provider';

import { usePlaybackQueue } from '#app/features/watch/hooks/use-playback-queue';

import { useVideoActions, type VideoActions } from '../use-video-actions';

async function renderActions(
  Providers: ComponentType<PropsWithChildren>,
  video = videoSummary({ id: VIDEO_ID })
) {
  const seen: { actions?: VideoActions; queued?: readonly string[] } = {};
  const Probe = () => {
    seen.actions = useVideoActions(video);
    seen.queued = usePlaybackQueue().videos.map(({ id }) => id);
    return null;
  };
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
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );

  return { router, actions: () => seen.actions, queued: () => seen.queued };
}

describe('apps/client/web: useVideoActions', () => {
  it('offers a guest the queue and not the playlists', async () => {
    const { actions } = await renderActions(AppProviders);

    expect(actions()?.save).toBeUndefined();
    expect(actions()?.enqueue).toBeTypeOf('function');
  });

  it('adds the video to the queue', async () => {
    const { actions, queued } = await renderActions(AppProviders);

    await act(async () => actions()?.enqueue?.());

    expect(queued()).toEqual([VIDEO_ID]);
  });

  it('offers no queue action for a Short', async () => {
    const { actions } = await renderActions(AppProviders, videoSummary({ format: 'short' }));

    expect(actions()?.enqueue).toBeUndefined();
  });

  it('lets a member save a video by opening the save dialog for it', async () => {
    const { router, actions } = await renderActions(signedIn());

    await act(async () => actions()?.save?.());

    expect(router.state.location.search).toEqual({
      modal: 'save-to-playlist',
      videoId: VIDEO_ID,
    });
  });
});
