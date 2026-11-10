import { createQueryClient } from '@vp/queries';
import { account } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { signedInWithToasts } from '#app/__tests__/providers';
import { youCache } from '#app/features/library/__tests__/you-cache';
import { STUDIO_URL } from '#app/lib/config';
import { UploadsShelf } from '../uploads-shelf';

describe('apps/client/web: UploadsShelf', () => {
  it('lists the viewer’s own videos under a heading that leads to the studio', async () => {
    const viewer = account();
    const markup = await renderPage(<UploadsShelf />, signedInWithToasts(viewer), {
      queryClient: youCache({ channelId: viewer.channel.id }),
    });

    expect(markup).toContain(`href="${STUDIO_URL}"`);
    expect(markup).toContain('My upload');
  });

  it('offers an upload while the shelf has nothing to show', async () => {
    const markup = await renderPage(<UploadsShelf />, signedInWithToasts(), {
      queryClient: createQueryClient(),
    });

    expect(markup).toContain('Videos you upload show up here');
    expect(markup).toContain('Upload a video');
  });
});
