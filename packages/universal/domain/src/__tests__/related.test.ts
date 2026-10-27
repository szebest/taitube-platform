import { type RelatedCandidate, compareRelated, relatedReasonOf } from '../related';

const none = { coWatchers: 0, sharedTags: 0, sameChannel: false, sameCategory: false };

describe('@vp/domain: related videos', () => {
  it.each([
    {
      scenario: 'viewers who watched both',
      signals: { ...none, coWatchers: 1 },
      reason: 'co-watched',
    },
    {
      scenario: 'co-watching over every other signal',
      signals: { coWatchers: 2, sharedTags: 3, sameChannel: true, sameCategory: true },
      reason: 'co-watched',
    },
    {
      scenario: 'shared tags',
      signals: { ...none, sharedTags: 1, sameChannel: true },
      reason: 'shared-tags',
    },
    {
      scenario: 'the same channel',
      signals: { ...none, sameChannel: true, sameCategory: true },
      reason: 'same-channel',
    },
    {
      scenario: 'the same category',
      signals: { ...none, sameCategory: true },
      reason: 'same-category',
    },
    { scenario: 'no signal', signals: none, reason: null },
  ])('explains $scenario as $reason', ({ signals, reason }) => {
    expect(relatedReasonOf(signals)).toBe(reason);
  });

  const candidate = (
    id: string,
    signals: Partial<typeof none>,
    viewsCount = 0
  ): RelatedCandidate => ({
    id,
    viewsCount,
    signals: { ...none, ...signals },
  });

  it.each([
    {
      scenario: 'co-watch over tags',
      ids: ['b', 'a'],
      candidates: [candidate('a', { sharedTags: 5 }), candidate('b', { coWatchers: 1 })],
    },
    {
      scenario: 'more co-watchers first',
      ids: ['b', 'a'],
      candidates: [candidate('a', { coWatchers: 1 }), candidate('b', { coWatchers: 2 })],
    },
    {
      scenario: 'tags over channel',
      ids: ['b', 'a'],
      candidates: [candidate('a', { sameChannel: true }), candidate('b', { sharedTags: 1 })],
    },
    {
      scenario: 'channel over category',
      ids: ['b', 'a'],
      candidates: [candidate('a', { sameCategory: true }), candidate('b', { sameChannel: true })],
    },
    {
      scenario: 'views, then id, on equal signals',
      ids: ['c', 'b', 'a'],
      candidates: [
        candidate('a', { sameCategory: true }, 1),
        candidate('b', { sameCategory: true }, 5),
        candidate('c', { sameCategory: true }, 5),
      ],
    },
  ])('ranks $scenario', ({ candidates, ids }) => {
    expect([...candidates].sort(compareRelated).map(({ id }) => id)).toEqual(ids);
  });
});
