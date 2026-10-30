import { createRootRouteWithContext, createRoute, Link, Outlet } from '@tanstack/react-router';
import { type AppRouterContext, type AppRouterOptions, createAppRouter } from '@vp/queries';
import type { ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { createUrlModals } from '../create-url-modals';

export const modals = createUrlModals({
  share: z.object({ videoId: z.string(), start: z.coerce.number().optional() }),
});

const { UrlModal, useUrlModal } = modals;

type SpecLinkProps = {
  to: string;
  search: Record<string, unknown>;
  replace?: boolean;
  children: ReactNode;
};

const SpecLink = Link as unknown as (props: SpecLinkProps) => ReactElement;

const TabSchema = z.object({ tab: z.enum(['videos', 'playlists']).optional() });

function Library() {
  const { open } = useUrlModal('share');

  return (
    <>
      <h1>Library</h1>
      <SpecLink to="/library" search={{ tab: 'playlists' }} replace>
        Playlists tab
      </SpecLink>
      <SpecLink to="/library" search={{ tab: 'videos' }}>
        Videos tab
      </SpecLink>
      <button type="button" onClick={() => open({ videoId: 'v1', start: 30 })}>
        Share
      </button>
      <UrlModal.Root id="share">
        <UrlModal.Content>
          <UrlModal.Title>Share video</UrlModal.Title>
          <UrlModal.Description>Anyone with the link</UrlModal.Description>
          <UrlModal.Body>
            <ShareBody />
          </UrlModal.Body>
        </UrlModal.Content>
      </UrlModal.Root>
    </>
  );
}

function ShareBody() {
  const { params } = useUrlModal('share');

  return (
    <>
      <p>{`Video ${params?.videoId} at ${params?.start ?? 0}s`}</p>
      <SpecLink to="/library" search={{ tab: 'playlists' }} replace>
        Playlists in the dialog
      </SpecLink>
    </>
  );
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: () => (
    <main>
      <Outlet />
    </main>
  ),
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/library',
  validateSearch: (search) => TabSchema.and(modals.searchSchema).parse(search),
  search: { middlewares: [modals.retainUrlModal] },
  component: Library,
});

const routeTree = rootRoute.addChildren([
  libraryRoute,
  createRoute({ getParentRoute: () => rootRoute, path: '/other', component: () => <h1>Other</h1> }),
]);

export function getSpecRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => <p>Pending</p>,
    },
    options
  );
}
