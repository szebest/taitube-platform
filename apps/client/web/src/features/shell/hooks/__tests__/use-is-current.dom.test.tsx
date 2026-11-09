import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import type { ShellTarget } from '#app/hooks/use-shell-destinations';
import { useIsCurrent } from '../use-is-current';

function CurrentProbe({ target }: { target: ShellTarget }) {
  const isCurrent = useIsCurrent();

  return <p>{isCurrent(target) ? 'current' : 'elsewhere'}</p>;
}

describe('apps/client/web: use is current', () => {
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
