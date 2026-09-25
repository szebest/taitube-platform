import {
  createComment,
  deleteComment,
  listCommentReplies,
  listVideoComments,
  pinComment,
  unpinComment,
  updateComment,
} from '../comments';

describe('packages/api-contracts: comments', () => {
  it.each([
    { endpoint: listVideoComments, method: 'GET', path: '/v1/videos/:id/comments' },
    { endpoint: createComment, method: 'POST', path: '/v1/videos/:id/comments' },
    { endpoint: listCommentReplies, method: 'GET', path: '/v1/comments/:id/replies' },
    { endpoint: updateComment, method: 'PATCH', path: '/v1/comments/:id' },
    { endpoint: deleteComment, method: 'DELETE', path: '/v1/comments/:id' },
    { endpoint: pinComment, method: 'POST', path: '/v1/comments/:id/pin' },
    { endpoint: unpinComment, method: 'DELETE', path: '/v1/comments/:id/pin' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it('lists top first by default', () => {
    expect(listVideoComments.query.parse({})).toMatchObject({ sort: 'top', limit: 20 });
  });

  it('reads the legacy page and size as numbers', () => {
    expect(listVideoComments.query.parse({ page: '2', size: '10' })).toMatchObject({
      page: 2,
      size: 10,
    });
  });

  it.each([{ sort: 'hot' }, { page: '0' }, { size: '1000' }])(
    'rejects the listing query %o',
    (query) => {
      expect(listVideoComments.query.safeParse(query).success).toBe(false);
    }
  );

  it('keeps the listings open to anonymous viewers and the writes closed', () => {
    expect([listVideoComments.anonymous, listCommentReplies.anonymous]).toEqual([true, true]);
    expect(createComment).not.toHaveProperty('anonymous');
  });

  it('refuses a reply that names a malformed parent', () => {
    expect(createComment.body.safeParse({ content: 'hi', parentId: 'nope' }).success).toBe(false);
  });

  it('promises a conflict when a reply is pinned', () => {
    expect(pinComment.errors[409]).toContain('COMMENT_NOT_PINNABLE');
  });
});
