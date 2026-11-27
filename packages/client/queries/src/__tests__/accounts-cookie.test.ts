import {
  type Accounts,
  NO_ACCOUNTS,
  withAccent,
  withDefault,
  withExpired,
  withPinned,
  withSignedIn,
  withoutSlot,
} from '../accounts';
import { readAccounts, writeAccounts } from '../accounts-cookie';
import { accountsAfter, accountsCookies, cookiesAfter } from './accounts-fixtures';
import { inRequest } from './in-request';

const signedIn = (accounts: Accounts, slot: number, label = `Account ${slot}`) =>
  withSignedIn(accounts, { slot, userId: `user-${slot}`, label, avatarUrl: null });

const TWO = signedIn(signedIn(NO_ACCOUNTS, 0), 1);

const LEGACY = `vp.accounts=${encodeURIComponent(JSON.stringify(withPinned(TWO, [{ slot: 1 }])))}`;

const names = (setCookies: readonly string[]) => setCookies.map((set) => set.split('=')[0]);

function write(accounts: Accounts, cookie = accountsCookies(TWO)) {
  return inRequest(() => writeAccounts(accounts, undefined), { cookie });
}

describe('@vp/queries: accounts cookie', () => {
  it('reads back the slot list it wrote, which scripts may read', async () => {
    const { setCookies } = await write(TWO, '');

    expect(names(setCookies)).toEqual(['vp.accounts.0', 'vp.accounts.1', 'vp.accounts']);
    for (const set of setCookies) expect(set).toMatch(/; Max-Age=2592000; Path=\/; SameSite=Lax$/);
    expect(await accountsAfter('', setCookies)).toEqual(TWO);
  });

  it.each([
    { change: 'an expired slot', next: withExpired(TWO, 0), written: ['vp.accounts.0'] },
    { change: 'an accent', next: withAccent(TWO, { slot: 0 }, 4), written: ['vp.accounts'] },
    {
      change: 'a switch',
      next: withDefault(TWO, 0, 'second'),
      written: ['vp.accounts.0', 'vp.accounts'],
    },
    { change: 'a slot signed out', next: withoutSlot(TWO, 0), written: ['vp.accounts.0'] },
    { change: 'nothing', next: TWO, written: [] },
  ])('writes only the cookies $change changes', async ({ next, written }) => {
    const { setCookies } = await write(next);

    expect(names(setCookies)).toEqual(written);
    expect(await accountsAfter(accountsCookies(TWO), setCookies)).toEqual(next);
  });

  it.each(['the expiry first', 'the add first'])(
    'keeps both of two tabs writing different slots at once, with %s',
    async (order) => {
      const expired = await write(withExpired(TWO, 1));
      const added = await write(signedIn(TWO, 2));
      const responses =
        order === 'the expiry first'
          ? [expired.setCookies, added.setCookies]
          : [added.setCookies, expired.setCookies];

      const cookie = cookiesAfter(accountsCookies(TWO), ...responses);

      expect((await inRequest(readAccounts, { cookie })).value).toEqual(
        signedIn(withExpired(TWO, 1), 2)
      );
    }
  );

  it('clears only the cookies the request carried, never a slot another tab may have just added', async () => {
    const { setCookies } = await write(NO_ACCOUNTS, accountsCookies(signedIn(NO_ACCOUNTS, 0)));

    expect(names(setCookies)).toEqual(['vp.accounts.0', 'vp.accounts']);
    for (const set of setCookies) expect(set).toContain('Max-Age=0');
  });

  it('reads the single cookie a browser kept before rows had their own, and moves it on the next write', async () => {
    const legacy = (await inRequest(readAccounts, { cookie: LEGACY })).value;

    const { setCookies } = await write(withAccent(legacy, { slot: 0 }, 4), LEGACY);

    expect(legacy).toEqual(withPinned(TWO, [{ slot: 1 }]));
    expect(names(setCookies)).toEqual(['vp.accounts.0', 'vp.accounts.1', 'vp.accounts']);
    expect(decodeURIComponent(setCookies.at(-1) ?? '')).not.toContain('"slots"');
    expect(await accountsAfter(LEGACY, setCookies)).toEqual(withAccent(legacy, { slot: 0 }, 4));
  });

  it("prefers a slot's own row over the one the old cookie kept", async () => {
    const renamed = signedIn(NO_ACCOUNTS, 1, 'Renamed');
    const cookie = `${accountsCookies(renamed).split('; ')[0]}; ${LEGACY}`;

    const { value } = await inRequest(readAccounts, { cookie });

    expect(value.slots.map(({ label }) => label)).toEqual(['Account 0', 'Renamed']);
  });

  it.each([
    'vp.accounts=%7Bnope',
    'vp.accounts=%7B%22defaultSlot%22%3A12%7D',
    'vp.accounts.3=%7Bnope',
    '',
  ])('reads "%s" as no accounts', async (cookie) => {
    expect((await inRequest(readAccounts, { cookie })).value).toEqual(NO_ACCOUNTS);
  });

  it('fits ten of the longest rows, every accent and every pin in the 4 KB one cookie had, dropping the avatar hints that would not fit', async () => {
    const rows = Array.from({ length: 10 }, (_, slot) => slot).reduce(
      (accounts, slot) =>
        withDefault(
          withSignedIn(accounts, {
            slot,
            userId: crypto.randomUUID(),
            label: '\u{6F22}'.repeat(40),
            avatarUrl: `https://cdn.example/${'a'.repeat(180)}`,
          }),
          slot,
          'h'.repeat(30)
        ),
      NO_ACCOUNTS
    );
    const channels = Array.from({ length: 10 }, (_, index) => ({
      slot: index,
      channel: `${String(index).padStart(2, '0')}${'h'.repeat(28)}`,
    }));
    const full = withPinned(
      channels.reduce((accounts, identity) => withAccent(accounts, identity, 6), rows),
      channels
    );

    const { setCookies } = await write(full, '');
    const read = await accountsAfter('', setCookies);

    expect(cookiesAfter('', setCookies).length).toBeLessThanOrEqual(4096);
    expect(read.slots.map(({ avatarUrl }) => avatarUrl)).toEqual(Array(10).fill(null));
    expect(Object.keys(read.accents ?? {})).toHaveLength(10);
    expect(read.pinned).toHaveLength(8);
  });

  it('keeps the avatar hint of a row that fits its share', async () => {
    const avatarUrl = `https://cdn.taitube.example/channels/${crypto.randomUUID()}/avatar/96.webp`;
    const pictured = withSignedIn(NO_ACCOUNTS, {
      slot: 0,
      userId: crypto.randomUUID(),
      label: 'Mateusz Szebestik',
      avatarUrl,
    });

    const { setCookies } = await write(pictured, '');

    expect((await accountsAfter('', setCookies)).slots[0]?.avatarUrl).toBe(avatarUrl);
  });
});
