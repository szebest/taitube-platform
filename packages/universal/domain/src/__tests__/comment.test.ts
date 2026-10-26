import { COMMENT_SORTS, CREATOR_INBOX_FILTERS, threadRootId } from '../comment';

describe('domain: comment threads', () => {
  it.each([
    { scenario: 'a root comment is its own thread', parentId: null, expected: 'c-1' },
    { scenario: 'a reply belongs to its root', parentId: 'root-1', expected: 'root-1' },
  ])('$scenario', ({ parentId, expected }) => {
    expect(threadRootId({ id: 'c-1', parentId })).toBe(expected);
  });

  it('opens on top, the order a watch page ranks by', () => {
    expect(COMMENT_SORTS).toEqual(['top', 'newest']);
  });

  it('filters the creator inbox to everything, what the creator has not answered, or what is reported', () => {
    expect(CREATOR_INBOX_FILTERS).toEqual(['all', 'unanswered', 'reported']);
  });
});
