import {
  RISING,
  type RisingCandidate,
  completionRatio,
  isRisingEligible,
  rankRising,
} from '../rising';

const candidate = (id: string, overrides: Partial<RisingCandidate> = {}): RisingCandidate => ({
  id,
  ownerId: `owner-${id}`,
  createdAt: new Date('2026-03-01T12:00:00.000Z'),
  subscriberCount: 10,
  sessions: 100,
  completed: 50,
  ...overrides,
});

const idsOf = (rows: readonly RisingCandidate[]) => rows.map(({ id }) => id);

describe('domain: rising', () => {
  it.each([
    { scenario: 'a half finished video', sessions: 100, completed: 50, ratio: 0.5 },
    { scenario: 'no sessions', sessions: 0, completed: 0, ratio: 0 },
  ])('completes $scenario at $ratio', ({ sessions, completed, ratio }) => {
    expect(completionRatio({ sessions, completed })).toBe(ratio);
  });

  it.each([
    {
      scenario: 'at both limits',
      subscriberCount: RISING.maxSubscribers,
      sessions: RISING.minSessions,
      eligible: true,
    },
    {
      scenario: 'one subscriber over',
      subscriberCount: RISING.maxSubscribers + 1,
      sessions: RISING.minSessions,
      eligible: false,
    },
    {
      scenario: 'one session short',
      subscriberCount: 5,
      sessions: RISING.minSessions - 1,
      eligible: false,
    },
  ])('judges a channel $scenario eligible: $eligible', ({ eligible, ...input }) => {
    expect(isRisingEligible(input)).toBe(eligible);
  });

  describe('rankRising', () => {
    const newer = new Date('2026-03-02T12:00:00.000Z');

    it.each([
      {
        scenario: 'best completion first',
        rows: [candidate('a', { completed: 20 }), candidate('b', { completed: 80 })],
        expected: ['b', 'a'],
      },
      {
        scenario: 'ties by newest',
        rows: [candidate('a'), candidate('b', { createdAt: newer })],
        expected: ['b', 'a'],
      },
      {
        scenario: 'one video per channel, the better one',
        rows: [
          candidate('a', { ownerId: 'o', completed: 10 }),
          candidate('b', { ownerId: 'o', completed: 90 }),
          candidate('c'),
        ],
        expected: ['b', 'c'],
      },
      {
        scenario: 'only the eligible',
        rows: [
          candidate('a', { subscriberCount: 5000 }),
          candidate('b', { sessions: 5, completed: 5 }),
          candidate('c'),
        ],
        expected: ['c'],
      },
    ])('ranks $scenario', ({ rows, expected }) => {
      expect(idsOf(rankRising(rows, 12))).toEqual(expected);
    });

    it('stops at the limit', () => {
      expect(idsOf(rankRising([candidate('a'), candidate('b'), candidate('c')], 2))).toHaveLength(
        2
      );
    });
  });
});
