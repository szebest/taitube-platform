import { renderHook } from '@testing-library/react';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { type ShellTarget, useIsCurrent, useShellDestinations } from '../shell-destinations';

function CurrentProbe({ target }: { target: ShellTarget }) {
  const isCurrent = useIsCurrent();

  return <p>{isCurrent(target) ? 'current' : 'elsewhere'}</p>;
}

describe('apps/client/web: shell destinations', () => {
  it.each([
    { viewer: 'a guest', Providers: AppProviders, ids: ['home', 'shorts', 'trending', 'live'] },
    {
      viewer: 'a signed-in viewer',
      Providers: signedIn(),
      ids: ['home', 'shorts', 'subscriptions', 'trending', 'live', 'your-channel', 'your-videos'],
    },
  ])(
    'lists the destinations $viewer can reach, in the order the rail shows them',
    ({ Providers, ids }) => {
      const { result } = renderHook(useShellDestinations, { wrapper: Providers });

      expect([...result.current.main, ...result.current.you].map(({ id }) => id)).toEqual(ids);
    }
  );

  it.each([
    { url: '/channel/c1', target: { kind: 'channel', channelId: 'c1' }, shown: 'current' },
    { url: '/channel/c1/videos', target: { kind: 'channel', channelId: 'c1' }, shown: 'current' },
    { url: '/channel/c10', target: { kind: 'channel', channelId: 'c1' }, shown: 'elsewhere' },
    { url: '/feed/trending', target: { kind: 'page', to: '/' }, shown: 'elsewhere' },
    { url: '/', target: { kind: 'page', to: '/' }, shown: 'current' },
    { url: '/', target: { kind: 'studio' }, shown: 'elsewhere' },
  ] satisfies Array<{ url: string; target: ShellTarget; shown: string }>)(
    'counts $url as $shown for a $target.kind destination',
    async ({ url, target, shown }) => {
      const html = await renderPage(<CurrentProbe target={target} />, AppProviders, {
        url,
        route: '$',
      });

      expect(html).toContain(`<p>${shown}</p>`);
    }
  );
});
