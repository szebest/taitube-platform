import { renderHook } from '@testing-library/react';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { useShellDestinations } from '../shell-destinations';

describe('apps/client/web: shell destinations', () => {
  it.each([
    { viewer: 'a guest', Providers: AppProviders, ids: ['home', 'trending'] },
    {
      viewer: 'a signed-in viewer',
      Providers: signedIn(),
      ids: ['home', 'subscriptions', 'trending', 'your-channel', 'your-videos'],
    },
  ])(
    'lists the destinations $viewer can reach, in the order the rail shows them',
    ({ Providers, ids }) => {
      const { result } = renderHook(useShellDestinations, { wrapper: Providers });

      expect([...result.current.main, ...result.current.you].map(({ id }) => id)).toEqual(ids);
    }
  );
});
