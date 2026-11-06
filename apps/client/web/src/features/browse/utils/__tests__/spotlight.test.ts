import { fallbackPick, scheduledPick, videoSummary } from '@vp/web-testing';
import { spotlightOf } from '../spotlight';

const WINDOW = { startsAt: '2026-10-30T08:00:00.000Z', endsAt: '2026-10-31T08:00:00.000Z' };
const VIDEO = videoSummary({ title: 'Lisbon at night' });

describe('apps/client/web: spotlightOf', () => {
  it.each([
    {
      name: 'a scheduled pick keeps its note and window',
      view: scheduledPick(WINDOW, { video: VIDEO, note: 'Trams' }),
      expected: { source: 'scheduled', video: VIDEO, note: 'Trams', endsAt: WINDOW.endsAt },
    },
    {
      name: 'a scheduled pick may have no note',
      view: scheduledPick(WINDOW, { video: VIDEO, note: null }),
      expected: { source: 'scheduled', video: VIDEO, note: null, endsAt: WINDOW.endsAt },
    },
    {
      name: 'a fallback has neither',
      view: fallbackPick({ video: VIDEO }),
      expected: { source: 'fallback', video: VIDEO },
    },
    {
      name: 'a fallback drops a note it should not carry',
      view: fallbackPick({ video: VIDEO, note: 'Stray', endsAt: WINDOW.endsAt }),
      expected: { source: 'fallback', video: VIDEO },
    },
    {
      name: 'a scheduled pick with no end cannot count down, so it is a fallback',
      view: scheduledPick(WINDOW, { video: VIDEO, endsAt: null }),
      expected: { source: 'fallback', video: VIDEO },
    },
  ])('$name', ({ view, expected }) => {
    expect(spotlightOf(view)).toEqual(expected);
  });
});
