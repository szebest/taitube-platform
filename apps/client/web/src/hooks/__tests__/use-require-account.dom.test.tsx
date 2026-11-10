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
import { account } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { urlModals } from '#app/lib/url-modal/registry';
import { useRequireAccount } from '../use-require-account';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-000000000007';

const perform = vi.fn();

function LikeButton() {
  const { allowed, run } = useRequireAccount('like');

  return (
    <button
      type="button"
      data-allowed={allowed}
      onClick={() => run(perform, { kind: 'like', id: VIDEO_ID })}
    >
      Like
    </button>
  );
}

function renderLike(Providers: ComponentType<PropsWithChildren>, url = '/watch?t=4') {
  const root = createRootRoute({
    validateSearch: urlModals.searchSchema,
    component: () => (
      <Providers>
        <Outlet />
      </Providers>
    ),
  });
  const watch = createRoute({ getParentRoute: () => root, path: '/watch', component: LikeButton });
  const router = createRouter({
    routeTree: root.addChildren([watch]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('apps/client/web: useRequireAccount', () => {
  beforeEach(() => perform.mockClear());

  it('opens the sign-in prompt with the reason, the way back and the intent for a guest', async () => {
    const router = renderLike(AppProviders);

    await userEvent.click(await screen.findByRole('button', { name: 'Like' }));

    await vi.waitFor(() =>
      expect(router.state.location.search).toEqual({
        t: 4,
        modal: 'sign-in',
        reason: 'like',
        redirect: '/watch?t=4',
        intent: `like:${VIDEO_ID}`,
      })
    );
    expect(router.state.location.pathname).toBe('/watch');
    expect(perform).not.toHaveBeenCalled();
  });

  it('does the action for a signed-in viewer and opens nothing', async () => {
    const router = renderLike(signedIn(account()));

    await userEvent.click(await screen.findByRole('button', { name: 'Like' }));

    expect(perform).toHaveBeenCalledOnce();
    expect(router.state.location.search).toEqual({ t: 4 });
  });

  it.each([
    { viewer: AppProviders, allowed: 'false' },
    { viewer: signedIn(account()), allowed: 'true' },
  ])('tells a view whether the viewer is allowed: $allowed', async ({ viewer, allowed }) => {
    renderLike(viewer);

    expect(await screen.findByRole('button', { name: 'Like' })).toHaveAttribute(
      'data-allowed',
      allowed
    );
  });
});
