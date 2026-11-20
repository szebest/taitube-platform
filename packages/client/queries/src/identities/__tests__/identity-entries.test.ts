import { identities } from '@vp/web-testing';
import { type Accounts, NO_ACCOUNTS, withExpired, withPinned, withSignedIn } from '../../accounts';
import { type IdentityEntrySources, identityEntries } from '../identity-entries';

const OWNER = '0190c3a0-5e1d-7000-8000-00000000b009';

const TWO: Accounts = [0, 3].reduce(
  (accounts, slot) =>
    withSignedIn(accounts, { slot, userId: `u${slot}`, label: `Account ${slot}`, avatarUrl: null }),
  NO_ACCOUNTS
);

const card = (handle: string) => ({
  id: crypto.randomUUID(),
  handle,
  displayName: handle.toUpperCase(),
  avatarUrl: null,
});

const MINE = identities({
  owned: [
    { ...card('main'), isPrimary: true },
    { ...card('second'), isPrimary: false },
  ],
  member: [{ ...card('team'), role: 'editor', ownerId: OWNER }],
});

function entries(overrides: Partial<IdentityEntrySources> = {}) {
  return identityEntries({
    accounts: TWO,
    tab: { slot: 0 },
    mine: MINE,
    glances: [],
    ...overrides,
  });
}

describe('@vp/queries: identity entries', () => {
  it('lists the tab account, its channels and teams under it, then the other accounts', () => {
    expect(
      entries().map(({ key, kind, name, current, role }) => [key, kind, name, current, role])
    ).toEqual([
      ['0.primary', 'account', 'MAIN', true, undefined],
      ['0.second', 'channel', 'SECOND', false, undefined],
      ['0.team', 'team', 'TEAM', false, 'editor'],
      ['3.primary', 'account', 'Account 3', false, undefined],
    ]);
  });

  it('puts the pinned rows first, in the order they were pinned', () => {
    const pinned = withPinned(TWO, [{ slot: 3 }, { slot: 0, channel: 'team' }]);

    expect(
      entries({ accounts: pinned }).map(({ key, pinned: isPinned }) => [key, isPinned])
    ).toEqual([
      ['3.primary', true],
      ['0.team', true],
      ['0.primary', false],
      ['0.second', false],
    ]);
  });

  it.each([
    {
      scenario: 'a counted glance',
      accounts: TWO,
      glances: [{ slot: 3, state: 'counted' as const, unread: 4 }],
      expired: false,
    },
    {
      scenario: 'a refused token',
      accounts: TWO,
      glances: [{ slot: 3, state: 'expired' as const }],
      expired: true,
    },
    { scenario: 'a row marked expired', accounts: withExpired(TWO, 3), glances: [], expired: true },
  ])('reads the other account with $scenario', ({ accounts, glances, expired }) => {
    const other = entries({ accounts, glances }).at(-1);

    expect(other).toMatchObject({ key: '3.primary', expired, glance: glances[0] });
  });

  it('draws the tab account from its slot row until its identities load', () => {
    expect(entries({ mine: undefined }).map(({ key, name }) => [key, name])).toEqual([
      ['0.primary', 'Account 0'],
      ['3.primary', 'Account 3'],
    ]);
  });
});
