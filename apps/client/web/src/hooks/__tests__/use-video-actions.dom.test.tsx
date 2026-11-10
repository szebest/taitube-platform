import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { VIDEO_ID, videoSummary } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';
import { PlaybackSessionStub } from '#app/__tests__/playback-session-stub';
import { AppProviders, signedIn, withToasts } from '#app/__tests__/providers';
import { usePlaybackQueue } from '../use-playback-queue';
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
        <PlaybackSessionStub>
          <Probe />
        </PlaybackSessionStub>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  const Toasting = withToasts(Providers);
  render(
    <Toasting>
      <RouterProvider router={router} />
    </Toasting>
  );

  return { router, actions: () => seen.actions, queued: () => seen.queued };
}

describe('apps/client/web: useVideoActions', () => {
  it('offers a guest both actions, and each opens the sign-in prompt instead of acting', async () => {
    const { router, actions, queued } = await renderActions(AppProviders);

    await act(async () => actions()?.enqueue?.());
    expect(router.state.location.search).toMatchObject({ modal: 'sign-in', reason: 'queue' });
    expect(queued()).toEqual([]);

    await act(async () => actions()?.save?.());
    expect(router.state.location.search).toMatchObject({
      modal: 'sign-in',
      reason: 'save',
      intent: `save:${VIDEO_ID}`,
    });
  });

  it('adds the video to the queue for a member, says so, and takes it out again on Undo', async () => {
    const { actions, queued } = await renderActions(signedIn());

    await act(async () => actions()?.enqueue?.());

    expect(queued()).toEqual([VIDEO_ID]);
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(queued()).toEqual([]);
  });

  it('says a video queued already is, and does not queue it twice', async () => {
    const { actions, queued } = await renderActions(signedIn());
    await act(async () => actions()?.enqueue?.());

    await act(async () => actions()?.enqueue?.());

    expect(await screen.findByText('Already in your queue')).toBeInTheDocument();
    expect(queued()).toEqual([VIDEO_ID]);
  });

  it('plays a video next, and puts the queue back on Undo', async () => {
    const { actions, queued } = await renderActions(signedIn());

    await act(async () => actions()?.playNext?.());

    expect(await screen.findByText('Playing next')).toBeInTheDocument();
    expect(queued()).toEqual([VIDEO_ID]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(queued()).toEqual([]);
  });

  it('offers a Short the queue actions too', async () => {
    const { actions } = await renderActions(AppProviders, videoSummary({ format: 'short' }));

    expect(actions()?.enqueue).toBeTypeOf('function');
    expect(actions()?.playNext).toBeTypeOf('function');
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
