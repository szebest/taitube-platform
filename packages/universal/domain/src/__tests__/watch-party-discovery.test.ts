import { MS_PER_HOUR } from '@kit/primitives';
import {
  watchPartyDiscoveryPosition,
  watchPartySearchText,
  watchPartyTrendScore,
} from '../watch-party-discovery';

const SCHEDULED = new Date('2026-03-02T20:00:00Z');
const CREATED = new Date('2026-03-01T12:00:00Z');
const ROW = {
  room: { id: 'r1', presentCount: 7, createdAt: CREATED, scheduledFor: SCHEDULED },
  trendScore: 1.5,
};

describe('@vp/domain: watch party discovery', () => {
  it.each([
    { scenario: 'a new empty room', recentJoins: 0, present: 0, ageMs: 0, score: 0 },
    { scenario: 'a new room of four', recentJoins: 2, present: 2, ageMs: 0, score: 4 / 2 ** 1.2 },
    {
      scenario: 'the same room three hours on',
      recentJoins: 2,
      present: 2,
      ageMs: 3 * MS_PER_HOUR,
      score: 4 / 5 ** 1.2,
    },
    {
      scenario: 'a clock skewed behind creation',
      recentJoins: 1,
      present: 0,
      ageMs: -5000,
      score: 1 / 2 ** 1.2,
    },
  ])('scores $scenario', ({ recentJoins, present, ageMs, score }) => {
    expect(watchPartyTrendScore({ recentJoins, present, ageMs })).toBeCloseTo(score, 10);
  });

  it.each([
    {
      scenario: 'everything known',
      parts: { name: 'Movie night', ownerHandle: 'ada', ownerName: 'Ada L', videoTitle: 'Heat' },
      text: 'Movie night ada Ada L Heat',
    },
    {
      scenario: 'no video yet and a blank owner name',
      parts: { name: 'Lobby', ownerHandle: 'ada', ownerName: ' ', videoTitle: null },
      text: 'Lobby ada',
    },
  ])('joins the searchable parts for $scenario', ({ parts, text }) => {
    expect(watchPartySearchText(parts)).toBe(text);
  });

  it.each([
    { sort: 'members', key: 7 },
    { sort: 'newest', key: CREATED },
    { sort: 'starting_soon', key: SCHEDULED },
    { sort: 'trending', key: 1.5 },
  ] as const)('resumes the $sort walk from its own key', ({ sort, key }) => {
    expect(watchPartyDiscoveryPosition(sort, ROW)).toEqual({ sort, key, id: 'r1' });
  });
});
