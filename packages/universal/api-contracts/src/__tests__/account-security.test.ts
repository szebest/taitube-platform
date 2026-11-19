import { listMySignIns, recordMySignIn } from '../account-security';

describe('packages/api-contracts: account security', () => {
  it('serves the sign-in history as a keyset page of the caller own rows', () => {
    expect(listMySignIns).toMatchObject({ method: 'GET', path: '/v1/me/security/sign-ins' });
    expect(listMySignIns.query.parse({})).toMatchObject({ limit: expect.any(Number) });
  });

  it.each([
    { scenario: 'a slot', slot: 3, ok: true },
    { scenario: 'no slot', slot: null, ok: true },
    { scenario: 'a slot past nine', slot: 10, ok: false },
  ])('takes a sign-in with $scenario', ({ slot, ok }) => {
    const row = {
      id: '00000000-0000-7000-8000-0000000000a1',
      action: 'account.signed_in',
      slot,
      userAgent: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(listMySignIns.result.safeParse({ items: [row], nextCursor: null }).success).toBe(ok);
  });

  it.each([
    { scenario: 'a slot and whether it was added', body: { slot: 2, added: true }, ok: true },
    { scenario: 'no slot', body: { added: false }, ok: false },
    { scenario: 'a token beside them', body: { slot: 0, added: false, token: 't' }, ok: false },
  ])('records a sign-in from $scenario: $ok', ({ body, ok }) => {
    expect(recordMySignIn).toMatchObject({ method: 'POST', status: 201 });
    expect(recordMySignIn.body.safeParse(body).success).toBe(ok);
  });
});
