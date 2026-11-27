import { PostsSearchSchema } from '../post-search';

describe('apps/client/studio: PostsSearchSchema', () => {
  it.each([
    { scenario: 'a stage', search: { status: 'draft' }, expected: { status: 'draft' } },
    { scenario: 'every stage, as absent', search: {}, expected: { status: undefined } },
    {
      scenario: 'a word that is no stage',
      search: { status: 'all' },
      expected: { status: undefined },
    },
    { scenario: 'a number', search: { status: 3 }, expected: { status: undefined } },
  ])('reads $scenario', ({ search, expected }) => {
    expect(PostsSearchSchema.parse(search)).toEqual(expected);
  });
});
