import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
  readScopeOf,
} from '../notifications';

const ID = '00000000-0000-7000-8000-0000000000a1';

describe('packages/api-contracts: notifications', () => {
  it.each([
    [listNotifications, 'GET', '/v1/me/notifications'],
    [getUnreadNotificationCount, 'GET', '/v1/me/notifications/unread-count'],
    [markNotificationsRead, 'POST', '/v1/me/notifications/read'],
  ])('declares %#: $method $path', (contract, method, path) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
  });

  it.each([
    { query: {}, filter: 'all' },
    { query: { filter: 'subscriptions' }, filter: 'subscriptions' },
    { query: { filter: 'mentions' }, filter: 'mentions' },
  ])('lists with the $filter filter for $query', ({ query, filter }) => {
    expect(listNotifications.query.parse(query)).toMatchObject({ filter });
  });

  it('refuses an unknown filter', () => {
    expect(listNotifications.query.safeParse({ filter: 'unread' }).success).toBe(false);
  });

  it.each([
    { scenario: 'ids', body: { ids: [ID] }, valid: true, scope: { scope: 'ids', ids: [ID] } },
    { scenario: 'all', body: { all: true }, valid: true, scope: { scope: 'all' } },
    { scenario: 'no ids', body: { ids: [] }, valid: false },
    { scenario: 'all: false', body: { all: false }, valid: false },
    { scenario: 'an empty body', body: {}, valid: false },
    { scenario: 'a non-uuid id', body: { ids: ['x'] }, valid: false },
  ])('reads $scenario for mark read', ({ body, valid, scope }) => {
    const parsed = markNotificationsRead.body.safeParse(body);

    expect(parsed.success).toBe(valid);
    if (parsed.success) expect(readScopeOf(parsed.data)).toEqual(scope);
  });

  it('answers a mark read with the unread count that is left', () => {
    expect(markNotificationsRead.result.parse({ unreadCount: 2 })).toEqual({ unreadCount: 2 });
    expect(markNotificationsRead.errors[403]).toContain('FORBIDDEN');
  });
});
