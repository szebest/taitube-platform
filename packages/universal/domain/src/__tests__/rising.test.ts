import { RISING, type RisingCandidate, rankRising } from '../rising';

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
        scenario: 'channels exactly at both limits',
        rows: [
          candidate('a', {
            subscriberCount: RISING.maxSubscribers,
            sessions: RISING.minSessions,
            completed: 1,
          }),
        ],
        expected: ['a'],
      },
      {
        scenario: 'not a channel one subscriber over or one session short',
        rows: [
          candidate('a', { subscriberCount: RISING.maxSubscribers + 1 }),
          candidate('b', { sessions: RISING.minSessions - 1, completed: 5 }),
        ],
        expected: [],
      },
      {
        scenario: 'a video with no sessions last',
        rows: [candidate('a', { sessions: 0, completed: 0 }), candidate('b', { completed: 1 })],
        expected: ['b'],
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
