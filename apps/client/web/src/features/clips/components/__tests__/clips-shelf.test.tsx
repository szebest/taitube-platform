import { QueryClient } from '@tanstack/react-query';
import { clipKeys } from '@vp/queries';
import { clip } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { ClipsShelf } from '../clips-shelf';

const OTHER_CLIP_ID = '0190c3a0-5e1d-7000-8000-00000000d002';

function renderShelf(items: ReturnType<typeof clip>[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(clipKeys.mine(), {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  });
  return renderPage(<ClipsShelf />, AppProviders, { queryClient });
}

describe('apps/client/web: clips shelf', () => {
  it('heads the shelf and lists every clip, each linking to its page', async () => {
    const markup = await renderShelf([
      clip({ title: 'First' }),
      clip({ id: OTHER_CLIP_ID, title: 'Second' }),
    ]);

    expect(markup).toContain('>Clips</h2>');
    expect(markup).toContain('>First</a>');
    expect(markup).toContain(`href="/clip/${OTHER_CLIP_ID}"`);
  });

  it('says there are no clips yet, with no shelf', async () => {
    const markup = await renderShelf([]);

    expect(markup).toContain('Clips you make from a video show up here');
    expect(markup).not.toContain('data-slot="shelf"');
  });
});
