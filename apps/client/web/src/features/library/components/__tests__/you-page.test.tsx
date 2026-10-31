import { account } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';

import { YouPage, YouPageSkeleton } from '../you-page';
import { youCache } from './you-cache';

describe('apps/client/web: YouPage', () => {
  it('has the heading and the four shelves in order', async () => {
    const viewer = account();
    const markup = await renderPage(<YouPage />, signedIn(viewer), {
      queryClient: youCache({ channelId: viewer.channel.id }),
    });

    expect(markup).toContain('>You</h1>');
    const order = ['>History<', '>Watch later<', '>Playlists<', '>Your videos<'].map((heading) =>
      markup.indexOf(heading)
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order).not.toContain(-1);
  });

  it('holds the place of the shelves while they load', async () => {
    const markup = await renderPage(<YouPageSkeleton />, signedIn());

    expect(markup.match(/data-slot="shelf-skeleton"/g)).toHaveLength(2);
  });
});
