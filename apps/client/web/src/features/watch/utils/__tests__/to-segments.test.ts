import { videoSummary } from '@vp/web-testing';
import { toSegments } from '../to-segments';

const video = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c001', durationMs: 200_000 });
const unmeasured = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c002' });

describe('apps/client/web: toSegments', () => {
  it.each([
    { scenario: 'a whole item', item: { startMs: null, endMs: null, video }, segments: {} },
    {
      scenario: 'a start and an end',
      item: { startMs: 30_000, endMs: 105_000, video },
      segments: { [video.id]: { startMs: 30_000, endMs: 105_000 } },
    },
    {
      scenario: 'a start only, ending where the video does',
      item: { startMs: 30_000, endMs: null, video },
      segments: { [video.id]: { startMs: 30_000, endMs: 200_000 } },
    },
    {
      scenario: 'an end only, starting at 0',
      item: { startMs: null, endMs: 12_000, video },
      segments: { [video.id]: { startMs: 0, endMs: 12_000 } },
    },
    {
      scenario: 'a start on a video of unknown length',
      item: { startMs: 5_000, endMs: null, video: unmeasured },
      segments: { [unmeasured.id]: { startMs: 5_000, endMs: Number.POSITIVE_INFINITY } },
    },
  ])('maps $scenario', ({ item, segments }) => {
    expect(toSegments([item])).toEqual(segments);
  });
});
