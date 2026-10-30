import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { getMyReaction, setReaction } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { ToastProvider } from '@vp/ui';
import { account, apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';
import { z } from 'zod';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { useReaction } from '../use-reaction';

function ReactionProbe() {
  const { reaction, change, likesCount } = useReaction(VIDEO_ID);

  return (
    <>
      <p>{`${reaction ?? 'none'} ${likesCount ?? 'unanswered'}`}</p>
      <button type="button" onClick={() => change('LIKE')}>
        Like
      </button>
    </>
  );
}

function renderReaction(Providers: ComponentType<PropsWithChildren>) {
  const client = createQueryClient();
  const show = vi.fn();
  const toaster = { show, subscribe: () => () => undefined };
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Providers>
          <ToastProvider toaster={toaster}>
            <Outlet />
          </ToastProvider>
        </Providers>
      </QueryClientProvider>
    ),
  });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: ReactionProbe });
  const login = createRoute({
    getParentRoute: () => root,
    path: '/login',
    validateSearch: z.object({ redirect: z.string() }),
  });
  const router = createRouter({
    routeTree: root.addChildren([page, login]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  return { router, show };
}

describe('apps/client/web: useReaction', () => {
  it('sends a guest who reacts to sign in', async () => {
    const { router } = renderReaction(AppProviders);

    await userEvent.click(await screen.findByRole('button', { name: 'Like' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it("holds the member's reaction and the count the API answered", async () => {
    apiServer.use(
      mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: VIDEO_ID, reaction: 'LIKE' })),
      mockEndpoint(setReaction, () =>
        HttpResponse.json({ videoId: VIDEO_ID, reaction: 'LIKE', likesCount: 25, dislikesCount: 0 })
      )
    );
    renderReaction(signedIn(account()));

    expect(await screen.findByText('LIKE unanswered')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Like' }));

    expect(await screen.findByText('LIKE 25')).toBeInTheDocument();
  });

  it('puts the reaction back when the API refuses it', async () => {
    apiServer.use(
      mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: VIDEO_ID, reaction: null })),
      mockEndpoint(setReaction, () => problemReply(ErrorCodes.INTERNAL))
    );
    const { show } = renderReaction(signedIn(account()));
    await screen.findByText('none unanswered');

    await userEvent.click(screen.getByRole('button', { name: 'Like' }));

    await vi.waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'danger', title: 'Your reaction could not be saved' })
      )
    );
    expect(screen.getByText('none unanswered')).toBeInTheDocument();
  });
});
