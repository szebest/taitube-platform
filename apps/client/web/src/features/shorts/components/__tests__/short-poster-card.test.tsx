import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { shortSummary } from '#app/features/shorts/__tests__/short-fixtures';
import { ShortPosterCard, type ShortPosterCardProps } from '../short-poster-card';

const renderCard = (video: ShortPosterCardProps['video'] = shortSummary(1)) =>
  renderPage(<ShortPosterCard video={video} />, AppProviders);

describe('apps/client/web: ShortPosterCard', () => {
  it('links its title to the Shorts player opened on that Short', async () => {
    const markup = await renderCard();

    expect(markup).toMatch(
      /<a[^>]*href="\/shorts\/0190c3a0-5e1d-7000-8000-00000000f001"[^>]*>Short 1<\/a>/
    );
  });

  it('draws the poster as the card image, preferring the thumbnail the creator chose', async () => {
    const markup = await renderCard(
      shortSummary(1, { thumbnailUrl: 'http://localhost:9000/thumbs/1.jpg' })
    );

    expect(markup).toContain('src="http://localhost:9000/thumbs/1.jpg"');
  });

  it('names a Short without a title as untitled', async () => {
    const markup = await renderCard(shortSummary(1, { title: null }));

    expect(markup).toContain('>Untitled video</a>');
  });
});
