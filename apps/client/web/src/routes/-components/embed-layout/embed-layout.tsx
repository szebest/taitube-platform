import { getRouteApi, Outlet } from '@tanstack/react-router';
import { ApiProvider } from '@vp/queries';
import { Tooltip } from '@vp/ui';

const rootRoute = getRouteApi('__root__');

/** A third-party page frames this: the player and the API client it reads from, nothing of the app. */
export function EmbedLayout() {
  const { api } = rootRoute.useRouteContext();

  return (
    <ApiProvider api={api}>
      <Tooltip.Provider>
        <Outlet />
      </Tooltip.Provider>
    </ApiProvider>
  );
}
