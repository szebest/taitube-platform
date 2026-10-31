import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';

import { AppProviders, signedIn } from '#app/__tests__/providers';

import { useVideoActions, type VideoActions } from '../use-video-actions';

async function renderActions(Providers: ComponentType<PropsWithChildren>) {
  const seen: { actions?: VideoActions } = {};
  const Probe = () => {
    seen.actions = useVideoActions(VIDEO_ID);
    return null;
  };
  const router = createRouter({
    routeTree: createRootRoute({ component: Probe }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );

  return { router, actions: () => seen.actions };
}

describe('apps/client/web: useVideoActions', () => {
  it('offers a guest nothing', async () => {
    const { actions } = await renderActions(AppProviders);

    expect(actions()).toEqual({ save: undefined });
  });

  it('lets a member save a video by opening the save dialog for it', async () => {
    const { router, actions } = await renderActions(signedIn());

    await act(async () => actions()?.save?.());

    expect(router.state.location.search).toEqual({
      modal: 'save-to-playlist',
      videoId: VIDEO_ID,
    });
    expect(actions()?.enqueue).toBeUndefined();
  });
});
