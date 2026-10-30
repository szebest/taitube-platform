import { ModerationSearchSchema, sortingOf, sortOf } from '../moderation-search';

describe('apps/client/studio: ModerationSearchSchema', () => {
  it('keeps the filters and sort the contract allows', () => {
    const search = { q: 'cats', status: 'READY', visibility: 'private', sort: 'views', order: 'asc' };

    expect(ModerationSearchSchema.parse(search)).toEqual(search);
  });

  it('reads a value the contract refuses as absent', () => {
    expect(
      ModerationSearchSchema.parse({ status: 'NOPE', visibility: 'secret', sort: 'oldest', order: 'up', categoryId: 'x' })
    ).toEqual({
      q: undefined,
      status: undefined,
      visibility: undefined,
      categoryId: undefined,
      sort: undefined,
      order: undefined,
    });
  });
});

describe('apps/client/studio: sortingOf and sortOf', () => {
  it.each([
    { search: {}, sorting: [{ id: 'createdAt', desc: true }] },
    { search: { sort: 'title', order: 'asc' }, sorting: [{ id: 'title', desc: false }] },
    { search: { sort: 'views' }, sorting: [{ id: 'viewsCount', desc: true }] },
    { search: { sort: 'likes', order: 'asc' }, sorting: [{ id: 'likesCount', desc: false }] },
    { search: { sort: 'comments' }, sorting: [{ id: 'createdAt', desc: true }] },
  ] as const)('shows $search as $sorting', ({ search, sorting }) => {
    expect(sortingOf(search)).toEqual(sorting);
  });

  it.each([
    { sorting: [{ id: 'title', desc: false }], search: { sort: 'title', order: 'asc' } },
    { sorting: [{ id: 'viewsCount', desc: true }], search: { sort: 'views', order: 'desc' } },
    { sorting: [], search: { sort: undefined, order: undefined } },
    { sorting: [{ id: 'channel', desc: true }], search: { sort: undefined, order: undefined } },
  ])('asks the URL for $search after $sorting', ({ sorting, search }) => {
    expect(sortOf(sorting)).toEqual(search);
  });
});
