import { listCreatorComments } from '../creator-comments';

describe('packages/api-contracts: creator comments', () => {
  it('serves the inbox to a signed-in caller', () => {
    expect(listCreatorComments).toMatchObject({ method: 'GET', path: '/v1/creator/comments' });
    expect(listCreatorComments).not.toHaveProperty('anonymous');
  });

  it('opens on every comment', () => {
    expect(listCreatorComments.query.parse({})).toMatchObject({ filter: 'all' });
  });

  it.each(['all', 'unanswered', 'reported'])('accepts the %s filter', (filter) => {
    expect(listCreatorComments.query.safeParse({ filter }).success).toBe(true);
  });

  it('refuses an unknown filter', () => {
    expect(listCreatorComments.query.safeParse({ filter: 'mine' }).success).toBe(false);
  });
});
