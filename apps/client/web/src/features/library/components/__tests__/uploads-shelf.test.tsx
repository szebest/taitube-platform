import { createQueryClient } from '@vp/queries';
import { account } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';
import { STUDIO_URL } from '#app/config';

import { UploadsShelf } from '../uploads-shelf';
import { youCache } from './you-cache';

describe('apps/client/web: UploadsShelf', () => {
  it('lists the viewer’s own videos under a heading that leads to the studio', async () => {
    const viewer = account();
    const markup = await renderPage(<UploadsShelf />, signedIn(viewer), {
      queryClient: youCache({ channelId: viewer.channel.id }),
    });

    expect(markup).toContain(`href="${STUDIO_URL}"`);
    expect(markup).toContain('My upload');
  });

  it('offers an upload while the shelf has nothing to show', async () => {
    const markup = await renderPage(<UploadsShelf />, signedIn(), {
      queryClient: createQueryClient(),
    });

    expect(markup).toContain('Videos you upload show up here');
    expect(markup).toContain('Upload a video');
  });
});
