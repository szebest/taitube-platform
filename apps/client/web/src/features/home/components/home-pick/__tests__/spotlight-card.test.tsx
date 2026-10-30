import { fallbackPick, scheduledPick, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { spotlightOf } from '../../../spotlight';
import { SpotlightCard } from '../spotlight-card';

const WINDOW = { startsAt: '2026-10-30T08:00:00.000Z', endsAt: '2026-10-31T08:00:00.000Z' };
const VIDEO = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a001', title: 'Lisbon at night' });

const renderCard = (view: Parameters<typeof spotlightOf>[0]) =>
  renderPage(<SpotlightCard spotlight={spotlightOf(view)} />, AppProviders);

describe('apps/client/web: SpotlightCard', () => {
  it('names the section, links the video and offers to watch it', async () => {
    const markup = await renderCard(fallbackPick({ video: VIDEO }));

    expect(markup).toContain('Pick of the day');
    expect(markup).toContain('href="/watch/0190c3a0-5e1d-7000-8000-00000000a001"');
    expect(markup).toContain('>Lisbon at night</a>');
    expect(markup).toContain('Watch');
  });

  it.each([
    { name: 'a scheduled pick', view: scheduledPick(WINDOW, { video: VIDEO, note: 'Trams' }), shown: true },
    { name: 'a fallback', view: fallbackPick({ video: VIDEO, note: 'Stray note' }), shown: false },
  ])('shows the note and window of $name: $shown', async ({ view, shown }) => {
    const markup = await renderCard(view);

    expect(markup.includes('data-slot="pick-of-the-day-note"')).toBe(shown);
    expect(markup.includes('data-slot="pick-of-the-day-window"')).toBe(shown);
  });
});
