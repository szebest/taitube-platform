import {
  type PublicFeedSort,
  type VideoRecord,
  publicFeedInstant,
  publicFeedRanking,
} from '@vp/core/ports';
import { selectPublicFeed } from '../public-feed-query';

const HOUR_MS = 3_600_000;
const NOW = publicFeedInstant();

function video(id: string, overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id,
    ownerId: 'owner-1',
    title: null,
    description: null,
    visibility: 'public',
    status: 'READY',
    sourceKey: `raw/${id}/source.mp4`,
    sourceSizeBytes: null,
    durationMs: null,
    width: null,
    height: null,
    ladder: null,
    viewsCount: 0,
    categoryId: null,
    generation: 1,
    version: 0,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    readyAt: new Date(NOW),
    deletedAt: null,
    ...overrides,
  };
}

const FEED = [
  video('a', { createdAt: new Date(NOW - 1 * HOUR_MS), viewsCount: 10, categoryId: 'music' }),
  video('b', { createdAt: new Date(NOW - 5 * HOUR_MS), viewsCount: 500, categoryId: 'gaming' }),
  video('c', { createdAt: new Date(NOW - 50 * HOUR_MS), viewsCount: 5000, categoryId: 'music' }),
  video('d', { createdAt: new Date(NOW - 100 * HOUR_MS), viewsCount: 1, categoryId: 'gaming' }),
];

describe('adapters/in-memory: public feed array query', () => {
  it.each<{ sort: PublicFeedSort | undefined; expected: string[] }>([
    { sort: undefined, expected: ['a', 'b', 'c', 'd'] },
    { sort: 'recent', expected: ['a', 'b', 'c', 'd'] },
    { sort: 'popular', expected: ['c', 'b', 'a', 'd'] },
    { sort: 'trending', expected: ['b', 'c', 'a', 'd'] },
  ])('orders by $sort', ({ sort, expected }) => {
    const result = selectPublicFeed(FEED, { limit: 10, sort });
    expect(result.items.map((v) => v.id)).toEqual(expected);
    expect(result.total).toBe(4);
  });

  it('breaks a rank tie on the id, descending', () => {
    const tied = [video('x', { viewsCount: 7 }), video('y', { viewsCount: 7 })];
    const result = selectPublicFeed(tied, { limit: 10, sort: 'popular' });
    expect(result.items.map((v) => v.id)).toEqual(['y', 'x']);
  });

  it.each<{ scenario: string; overrides: Partial<VideoRecord> }>([
    { scenario: 'private', overrides: { visibility: 'private' } },
    { scenario: 'unlisted', overrides: { visibility: 'unlisted' } },
    { scenario: 'not READY', overrides: { status: 'PROCESSING' } },
    { scenario: 'soft-deleted', overrides: { deletedAt: new Date(NOW) } },
  ])('drops a $scenario video from the page and the total', ({ overrides }) => {
    const result = selectPublicFeed([...FEED, video('e', overrides)], { limit: 10 });
    expect(result.items.map((v) => v.id)).not.toContain('e');
    expect(result.total).toBe(4);
  });

  it('filters by category and counts only that category', () => {
    const result = selectPublicFeed(FEED, { limit: 10, categoryId: 'music' });
    expect(result.items.map((v) => v.id)).toEqual(['a', 'c']);
    expect(result.total).toBe(2);
  });

  it('returns limit + 1 rows so the caller can detect a next page', () => {
    const result = selectPublicFeed(FEED, { limit: 2 });
    expect(result.items.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(result.total).toBe(4);
  });

  it.each<{ sort: PublicFeedSort; expected: string[] }>([
    { sort: 'recent', expected: ['b', 'c', 'd'] },
    { sort: 'popular', expected: ['b', 'a', 'd'] },
    { sort: 'trending', expected: ['c', 'a', 'd'] },
  ])('resumes $sort after the cursor row', ({ sort, expected }) => {
    const ranking = publicFeedRanking(sort);
    const first = selectPublicFeed(FEED, { limit: 1, sort }).items[0] as VideoRecord;
    const cursor = {
      id: first.id,
      createdAt: first.createdAt,
      viewsCount: first.viewsCount,
      score: ranking.rankOf(first, NOW),
    };

    const page = selectPublicFeed(FEED, { limit: 10, sort, cursor });
    expect(page.items.map((v) => v.id)).toEqual(expected);
    expect(page.total).toBe(4);
  });

  it('ignores a cursor that carries no key for the requested sort', () => {
    const page = selectPublicFeed(FEED, { limit: 10, sort: 'popular', cursor: { id: 'a' } });
    expect(page.items.map((v) => v.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
