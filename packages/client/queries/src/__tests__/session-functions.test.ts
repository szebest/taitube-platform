import { type Accounts, NO_ACCOUNTS, withSignedIn } from '../accounts';
import {
  expireSession,
  hasSession,
  rememberIdentity,
  signOut,
  signOutAll,
  startAddAccount,
} from '../session-functions';
import { inRequest } from './in-request';

const ACCOUNTS = [0, 1, 2].reduce<Accounts>(
  (accounts, slot) =>
    withSignedIn(accounts, {
      slot,
      userId: `user-${slot}`,
      label: `Account ${slot}`,
      avatarUrl: null,
    }),
  NO_ACCOUNTS
);

const THREE_SLOTS = `vp.session.0=a; vp.session.1=b; vp.session.2=c; vp.accounts=${encodeURIComponent(
  JSON.stringify(ACCOUNTS)
)}`;

const names = (setCookies: string[]) => setCookies.map((set) => set.split(';')[0]?.split('=')[0]);

function accountsWritten(setCookies: string[]): Accounts {
  const written = setCookies.find((set) => set.startsWith('vp.accounts='))?.split(';')[0] ?? '';
  return JSON.parse(decodeURIComponent(written.slice('vp.accounts='.length)));
}

describe('@vp/queries: session server functions', () => {
  it.each([
    { cookie: 'vp.session.1=t0ken', slot: 1, expected: true },
    { cookie: 'vp.session.1=t0ken', slot: 0, expected: false },
    { cookie: 'vp.session=t0ken', slot: 0, expected: true },
    { cookie: 'vp.theme=dark', slot: 0, expected: false },
  ])(
    'sees a session for slot $slot in "$cookie": $expected',
    async ({ cookie, slot, expected }) => {
      expect((await inRequest(() => hasSession({ data: { slot } }), { cookie })).value).toBe(
        expected
      );
    }
  );

  it('signs one slot out, leaves the others, and names the slot the tab moves to', async () => {
    const { value, setCookies } = await inRequest(() => signOut({ data: { slot: 2 } }), {
      cookie: THREE_SLOTS,
    });

    expect(names(setCookies)).toEqual(['vp.session.2', 'vp.accounts']);
    expect(setCookies[0]).toMatch(/Max-Age=0; Path=\/; HttpOnly/);
    expect(accountsWritten(setCookies).slots.map(({ slot }) => slot)).toEqual([0, 1]);
    expect(value).toEqual({ next: { slot: 0 }, accounts: 2 });
  });

  it('signs the last slot out to nowhere', async () => {
    const { value } = await inRequest(() => signOut({ data: { slot: 0 } }), {
      cookie: 'vp.session=legacy',
    });

    expect(value).toEqual({ next: undefined, accounts: 0 });
  });

  it('signs every slot out and forgets the slot list', async () => {
    const { value, setCookies } = await inRequest(() => signOutAll(), { cookie: THREE_SLOTS });

    expect(value).toEqual([0, 1, 2]);
    expect(names(setCookies)).toEqual([
      'vp.session.0',
      'vp.session.1',
      'vp.session.2',
      'vp.accounts',
    ]);
    for (const set of setCookies) expect(set).toContain('Max-Age=0');
  });

  it('expires one slot: its cookie goes, its row stays marked for a re-auth', async () => {
    const { setCookies } = await inRequest(() => expireSession({ data: { slot: 1 } }), {
      cookie: THREE_SLOTS,
    });

    expect(names(setCookies)).toEqual(['vp.session.1', 'vp.accounts']);
    expect(accountsWritten(setCookies).slots.map(({ expired }) => expired)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('remembers the identity a tab switched to as the default for a new tab', async () => {
    const { setCookies } = await inRequest(
      () => rememberIdentity({ data: { slot: 1, channel: 'second' } }),
      { cookie: THREE_SLOTS }
    );

    expect(accountsWritten(setCookies)).toMatchObject({
      defaultSlot: 1,
      slots: [{ channel: null }, { channel: 'second' }, { channel: null }],
    });
  });

  it('starts an add with a fresh state, kept in a short-lived cookie no script reads', async () => {
    const first = await inRequest(() => startAddAccount());
    const second = await inRequest(() => startAddAccount());

    expect(first.value).not.toBe(second.value);
    expect(first.setCookies).toEqual([
      `vp.add-nonce=${first.value}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax`,
    ]);
  });

  it('refuses a slot it does not know', async () => {
    await expect(inRequest(() => signOut({ data: { slot: 10 } }))).rejects.toThrow();
  });
});
