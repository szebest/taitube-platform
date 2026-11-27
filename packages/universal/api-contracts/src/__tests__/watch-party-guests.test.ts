import { joinWatchPartyAsGuest } from '../watch-party-guests';

describe('packages/api-contracts: watch party guests', () => {
  it.each([
    { scenario: 'nothing but the link', body: undefined, ok: true },
    { scenario: 'an invite link token', body: { invite: 'tok_abc' }, ok: true },
    { scenario: 'a token past 128 characters', body: { invite: 't'.repeat(129) }, ok: false },
  ])('takes a guest seat with $scenario: $ok', ({ body, ok }) => {
    expect(joinWatchPartyAsGuest.body.safeParse(body).success).toBe(ok);
  });
});
