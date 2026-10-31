import { cancelPick, createPick, getCurrentPick, listAdminPicks, updatePick } from '../picks';

const window = { startsAt: '2026-03-02T00:00:00Z', endsAt: '2026-03-03T00:00:00Z' };
const videoId = '00000000-0000-7000-8000-00000000000a';

describe('packages/api-contracts: picks', () => {
  it.each([
    { endpoint: getCurrentPick, method: 'GET', path: '/v1/picks/current', status: 200 },
    { endpoint: listAdminPicks, method: 'GET', path: '/v1/admin/picks', status: 200 },
    { endpoint: createPick, method: 'POST', path: '/v1/admin/picks', status: 201 },
    { endpoint: updatePick, method: 'PATCH', path: '/v1/admin/picks/:id', status: 200 },
    { endpoint: cancelPick, method: 'DELETE', path: '/v1/admin/picks/:id', status: 204 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('reads the current pick without a sign-in', () => {
    expect(getCurrentPick.anonymous).toBe(true);
  });

  it.each([
    { scenario: 'a window and a video', body: { videoId, ...window }, ok: true },
    { scenario: 'a note', body: { videoId, ...window, note: 'Worth it' }, ok: true },
    { scenario: 'a null note', body: { videoId, ...window, note: null }, ok: true },
    {
      scenario: 'an offset instant',
      body: { videoId, startsAt: '2026-03-02T01:00:00+01:00', endsAt: window.endsAt },
      ok: true,
    },
    { scenario: 'a missing video', body: window, ok: false },
    { scenario: 'a video that is not a UUID', body: { videoId: 'nope', ...window }, ok: false },
    {
      scenario: 'a date without a time',
      body: { videoId, startsAt: '2026-03-02', endsAt: window.endsAt },
      ok: false,
    },
    { scenario: 'a missing end', body: { videoId, startsAt: window.startsAt }, ok: false },
  ])('checks the create body of $scenario', ({ body, ok }) => {
    expect(createPick.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { scenario: 'a note alone', body: { note: 'x' }, ok: true },
    { scenario: 'clearing the note', body: { note: null }, ok: true },
    { scenario: 'an end alone', body: { endsAt: window.endsAt }, ok: true },
    { scenario: 'nothing', body: {}, ok: false },
    { scenario: 'a bad video id', body: { videoId: 'nope' }, ok: false },
  ])('checks the update body of $scenario', ({ body, ok }) => {
    expect(updatePick.body.safeParse(body).success).toBe(ok);
  });

  it('refuses a pick id that is not a UUID', () => {
    expect(cancelPick.params.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it.each([
    { scenario: 'no range', query: {}, ok: true },
    { scenario: 'a range', query: { from: window.startsAt, to: window.endsAt }, ok: true },
    { scenario: 'a range that is not a time', query: { from: 'tomorrow' }, ok: false },
  ])('checks the list query of $scenario', ({ query, ok }) => {
    expect(listAdminPicks.query.safeParse(query).success).toBe(ok);
  });
});
