import { bulkModerateComments, listCreatorComments } from '../creator-comments';

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

  it.each([
    { ids: ['00000000-0000-7000-8000-000000000001'], action: { action: 'approve' } },
    {
      ids: ['00000000-0000-7000-8000-000000000001'],
      action: { action: 'hide', disclosure: 'visible', reason: 'spam' },
    },
    { ids: ['00000000-0000-7000-8000-000000000001'], action: { action: 'ban', reason: 'spam' } },
    { ids: ['00000000-0000-7000-8000-000000000001'], action: { action: 'lift' } },
  ])('accepts the bulk body %o', (body) => {
    expect(bulkModerateComments.body.safeParse(body).success).toBe(true);
  });

  it.each([
    { scenario: 'no ids', body: { ids: [], action: { action: 'approve' } } },
    {
      scenario: 'a hundred and one ids',
      body: {
        ids: Array.from({ length: 101 }, () => '00000000-0000-7000-8000-000000000001'),
        action: { action: 'approve' },
      },
    },
    {
      scenario: 'an unknown action',
      body: { ids: ['00000000-0000-7000-8000-000000000001'], action: { action: 'explode' } },
    },
  ])('refuses the bulk body with $scenario', ({ body }) => {
    expect(bulkModerateComments.body.safeParse(body).success).toBe(false);
  });
});
