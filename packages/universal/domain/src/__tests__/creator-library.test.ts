import { creatorLibraryCursorOf } from '../creator-library';

const row = {
  id: 'video-1',
  title: 'Alpha',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  viewsCount: 40,
  likesCount: 7,
  commentsCount: 3,
};

describe('@vp/domain: creatorLibraryCursorOf', () => {
  it.each([
    { sort: 'newest' as const, value: row.createdAt },
    { sort: 'views' as const, value: 40 },
    { sort: 'likes' as const, value: 7 },
    { sort: 'comments' as const, value: 3 },
    { sort: 'title' as const, value: 'Alpha' },
  ])('keys a $sort page on the column that sort orders by', ({ sort, value }) => {
    expect(creatorLibraryCursorOf(row, sort)).toEqual({ sort, value, id: 'video-1' });
  });

  it.each([
    { sort: 'views' as const, value: 0 },
    { sort: 'title' as const, value: '' },
  ])('reads an absent $sort key as its column default', ({ sort, value }) => {
    expect(creatorLibraryCursorOf({ id: 'video-2', createdAt: row.createdAt }, sort)).toEqual({
      sort,
      value,
      id: 'video-2',
    });
  });
});
