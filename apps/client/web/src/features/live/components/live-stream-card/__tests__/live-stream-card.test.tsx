import { CHANNEL_ID, liveStream } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { LiveStreamCard } from '../live-stream-card';

const renderCard = (overrides: Parameters<typeof liveStream>[0] = {}) =>
  renderPage(<LiveStreamCard stream={liveStream(overrides)} variant="grid" />, AppProviders);

describe('apps/client/web: LiveStreamCard', () => {
  it.each([
    {
      scenario: 'a titled broadcast',
      title: 'Lisbon trams at dusk',
      shown: '>Lisbon trams at dusk</a>',
    },
    { scenario: 'an untitled broadcast', title: '', shown: '>Untitled video</a>' },
  ])('titles $scenario, with its viewers, in the live state', async ({ title, shown }) => {
    const markup = await renderCard({ title });

    expect(markup).toContain(shown);
    expect(markup).toContain('41 watching');
    expect(markup).toContain('data-slot="video-thumbnail-live"');
    expect(markup).toContain(`href="/channel/${CHANNEL_ID}"`);
  });
});
