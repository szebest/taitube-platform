import { listMyCommentRemovals } from '../comment-removals';

describe('packages/api-contracts: comment removals', () => {
  it('serves the removals of the caller to a signed-in user', () => {
    expect(listMyCommentRemovals).toMatchObject({ method: 'GET', path: '/v1/me/comment-removals' });
    expect(listMyCommentRemovals).not.toHaveProperty('anonymous');
  });

  it('pages by keyset', () => {
    expect(listMyCommentRemovals.query.safeParse({ limit: '5' }).success).toBe(true);
  });
});
