import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';

import { useIsWatching, useOwnsPlayer } from '../use-is-watching';

const seen: { watching?: boolean; owns?: boolean } = {};

function Probe() {
  seen.watching = useIsWatching();
  seen.owns = useOwnsPlayer();
  return null;
}

const root = createRootRoute();
const anyPage = createRoute({ getParentRoute: () => root, path: '$', component: Probe });

async function renderAt(path: string) {
  const router = createRouter({
    routeTree: root.addChildren([anyPage]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);

  return seen;
}

describe('apps/client/web: useIsWatching', () => {
  it.each([
    { path: '/watch/abc', watching: true, owns: false },
    { path: '/clip/abc', watching: false, owns: true },
    { path: '/live/abc', watching: false, owns: true },
    { path: '/shorts/abc', watching: false, owns: true },
    { path: '/', watching: false, owns: false },
  ])(
    'reads $path as watching $watching and owning a player $owns',
    async ({ path, watching, owns }) => {
      expect({ ...(await renderAt(path)) }).toEqual({ watching, owns });
    }
  );
});
