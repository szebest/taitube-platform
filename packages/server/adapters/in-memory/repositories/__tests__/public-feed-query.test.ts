import {
  PUBLIC_FEED_INSTANT_GRANULARITY_MS,
  type PublicFeedSort,
  publicFeedInstant,
} from '@vp/domain';
import type { VideoRecord } from '@vp/core/repositories';
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

function cursorFor(video: VideoRecord, instant: number) {
  return { id: video.id, createdAt: video.createdAt, viewsCount: video.viewsCount, instant };
}

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
    const firstPage = selectPublicFeed(FEED, { limit: 1, sort });
    const first = firstPage.items[0] as VideoRecord;

    const page = selectPublicFeed(FEED, {
      limit: 10,
      sort,
      cursor: cursorFor(first, firstPage.instant),
    });
    expect(page.items.map((v) => v.id)).toEqual(expected);
    expect(page.total).toBe(4);
  });

  it('reports the instant it ranked the page against', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW + 17);
    expect(selectPublicFeed(FEED, { limit: 10, sort: 'trending' }).instant).toBe(NOW);
    vi.restoreAllMocks();
  });

  it('scores a resumed page against the cursor instant, not the clock it resumes at', () => {
    const firstPage = selectPublicFeed(FEED, { limit: 1, sort: 'trending' });
    const first = firstPage.items[0] as VideoRecord;
    const cursor = cursorFor(first, firstPage.instant);

    vi.spyOn(Date, 'now').mockReturnValue(NOW + 40 * PUBLIC_FEED_INSTANT_GRANULARITY_MS);
    const page = selectPublicFeed(FEED, { limit: 10, sort: 'trending', cursor });
    vi.restoreAllMocks();

    expect(page.instant).toBe(firstPage.instant);
    expect(page.items.map((v) => v.id)).toEqual(['c', 'a', 'd']);
  });
});
