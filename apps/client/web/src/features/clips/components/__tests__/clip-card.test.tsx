import { CLIP_ID, clip, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { ClipCard } from '../clip-card';

const renderCard = (overrides: Parameters<typeof clip>[0] = {}) =>
  renderPage(<ClipCard clip={clip(overrides)} />, AppProviders);

describe('apps/client/web: clip card', () => {
  it('links the clip title to the clip page and names the video it is from', async () => {
    const markup = await renderCard({ video: videoSummary({ title: 'Lisbon at night' }) });

    expect(markup).toContain(`href="/clip/${CLIP_ID}"`);
    expect(markup).toContain('>The best part</a>');
    expect(markup).toContain('Lisbon at night');
  });

  it('shows the length of the clip, not of the video', async () => {
    const markup = await renderCard({ startMs: 20_000, endMs: 50_000 });

    expect(markup).toContain('00:30');
  });
});
