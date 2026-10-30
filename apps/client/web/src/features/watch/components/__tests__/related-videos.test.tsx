import { createQueryClient } from '@vp/queries';
import { VIDEO_ID, api, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { relatedQueryOptions } from '#app/features/watch/api/related-queries';
import { RelatedVideos } from '../related-videos';

function renderRelated(items: ReturnType<typeof related>[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(relatedQueryOptions(api, VIDEO_ID).queryKey, { items });
  return renderPage(<RelatedVideos videoId={VIDEO_ID} />, AppProviders, { queryClient });
}

const related = (title: string) => ({
  ...videoSummary({ title }),
  reason: { kind: 'co-watched' as const },
});

describe('apps/client/web: related videos', () => {
  it('lists the related videos under "More like this", each with why', async () => {
    const markup = await renderRelated([related('Tram ride')]);

    expect(markup).toContain('>More like this</h2>');
    expect(markup).toContain('>Tram ride</a>');
    expect(markup).toContain('Viewers also watched');
  });

  it('shows nothing when no video is related', async () => {
    expect(await renderRelated([])).toBe('');
  });
});
