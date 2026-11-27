import { renderHook } from '@testing-library/react';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { useShellDestinations } from '../use-shell-destinations';

describe('apps/client/web: use shell destinations', () => {
  it.each([
    {
      viewer: 'a guest',
      Providers: AppProviders,
      ids: ['home', 'shorts', 'trending', 'live', 'settings'],
      hub: undefined,
    },
    {
      viewer: 'a signed-in viewer',
      Providers: signedIn(),
      ids: [
        'home',
        'shorts',
        'subscriptions',
        'trending',
        'live',
        'settings',
        'history',
        'your-channel',
        'your-videos',
      ],
      hub: 'you',
    },
  ])(
    'lists the destinations $viewer can reach, in the order the rail shows them, and the You hub',
    ({ Providers, ids, hub }) => {
      const { result } = renderHook(useShellDestinations, { wrapper: Providers });

      expect([...result.current.main, ...result.current.you].map(({ id }) => id)).toEqual(ids);
      expect(result.current.hub?.id).toBe(hub);
    }
  );
});
