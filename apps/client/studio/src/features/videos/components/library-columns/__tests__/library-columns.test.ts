import { createLibraryColumns, LIBRARY_SKELETON_COLUMNS, sortOfColumn } from '../library-columns';

describe('apps/client/studio: library columns', () => {
  it('lays the table out as the video, status, visibility, date, three counters and a menu', () => {
    expect(createLibraryColumns(() => undefined).map(({ id }) => id)).toEqual([
      'title',
      'status',
      'visibility',
      'date',
      'views',
      'likes',
      'comments',
      'actions',
    ]);
  });

  it('gives every column but the video a width that holds its content, and the video the rest', () => {
    const widths = LIBRARY_SKELETON_COLUMNS.map(({ meta }) => meta.width);

    expect(widths).toEqual([
      'auto',
      '8rem',
      '7rem',
      '7.5rem',
      '5.5rem',
      '5.5rem',
      '6rem',
      '3.5rem',
    ]);
  });

  it('gives the skeleton the width of every column', () => {
    expect(LIBRARY_SKELETON_COLUMNS).toHaveLength(8);
    expect(LIBRARY_SKELETON_COLUMNS.every(({ meta }) => meta.width !== undefined)).toBe(true);
  });

  it.each([
    { column: 'date', sort: 'newest' },
    { column: 'views', sort: 'views' },
    { column: 'likes', sort: 'likes' },
    { column: 'comments', sort: 'comments' },
    { column: 'status', sort: undefined },
    { column: undefined, sort: undefined },
  ])('reads the $column column as the $sort sort', ({ column, sort }) => {
    expect(sortOfColumn(column)).toBe(sort);
  });
});
