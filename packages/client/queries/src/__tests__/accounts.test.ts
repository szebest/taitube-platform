import {
  type Accounts,
  NO_ACCOUNTS,
  accentOf,
  defaultSlotOf,
  firstFreeSlot,
  parseAccounts,
  serializeAccounts,
  slotOfUser,
  withDefault,
  withAccent,
  withExpired,
  withPinned,
  withSignedIn,
  withoutSlot,
} from '../accounts';

const signedIn = (accounts: Accounts, slot: number, userId = `user-${slot}`) =>
  withSignedIn(accounts, { slot, userId, label: `Account ${slot}`, avatarUrl: null });

const TWO = signedIn(signedIn(NO_ACCOUNTS, 0), 2);

describe('@vp/queries: accounts', () => {
  it('lists slots in order, the newest sign-in as the default, without a duplicate row', () => {
    const accounts = signedIn(signedIn(TWO, 1), 2, 'someone-else');

    expect(accounts.defaultSlot).toBe(2);
    expect(accounts.slots.map(({ slot, userId }) => [slot, userId])).toEqual([
      [0, 'user-0'],
      [1, 'user-1'],
      [2, 'someone-else'],
    ]);
  });

  it.each([
    { script: 'Latin', label: 'x'.repeat(100), kept: 'x'.repeat(40) },
    { script: 'CJK', label: '\u{6F22}'.repeat(40), kept: '\u{6F22}'.repeat(10) },
    { script: 'emoji', label: '\u{1F3AC}'.repeat(40), kept: '\u{1F3AC}'.repeat(7) },
    { script: 'a broken surrogate', label: '\u{D800}ok', kept: '\u{FFFD}ok' },
  ])('cuts a $script label to what the cookie holds', ({ label, kept }) => {
    const [entry] = withSignedIn(NO_ACCOUNTS, {
      slot: 0,
      userId: 'u',
      label,
      avatarUrl: null,
    }).slots;

    expect(entry?.label).toBe(kept);
  });

  it('keeps an avatar only when it fits the cookie', () => {
    const [entry] = withSignedIn(NO_ACCOUNTS, {
      slot: 0,
      userId: 'u',
      label: 'A',
      avatarUrl: `https://cdn.example/${'a'.repeat(300)}`,
    }).slots;

    expect(entry).toMatchObject({ avatarUrl: null, expired: false, channel: null });
  });

  it('fits ten of the longest rows, every accent and every pin in one cookie, dropping the avatar hints that would not fit', () => {
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
      slot: index % 10,
      channel: `${String(index).padStart(2, '0')}${'h'.repeat(28)}`,
    }));
    const full = withPinned(
      channels.reduce((accounts, identity) => withAccent(accounts, identity, 6), rows),
      channels
    );

    const value = serializeAccounts(full);

    expect(`vp.accounts=${encodeURIComponent(value)}`.length).toBeLessThanOrEqual(4096);
    expect(parseAccounts(value).slots.map(({ avatarUrl }) => avatarUrl)).toEqual(
      Array.from({ length: 10 }, () => null)
    );
    expect(Object.keys(parseAccounts(value).accents ?? {})).toHaveLength(10);
    expect(parseAccounts(value).pinned).toHaveLength(8);
    expect(serializeAccounts(TWO)).toBe(JSON.stringify(TWO));
  });

  it.each([
    { identity: { slot: 0 }, accent: 1 },
    { identity: { slot: 7 }, accent: 2 },
    { identity: { slot: 0, channel: 'second' }, accent: 1 },
  ])('gives $identity the accent its slot derives until one is picked', ({ identity, accent }) => {
    expect(accentOf(TWO, identity)).toBe(accent);
    expect(accentOf(withAccent(TWO, identity, 5), identity)).toBe(5);
  });

  it('keeps the newest ten accents and the first eight pins, once each', () => {
    const many = Array.from({ length: 15 }, (_, index) => ({ slot: 0, channel: `c${index}` }));
    const accented = many.reduce((accounts, identity) => withAccent(accounts, identity, 3), TWO);
    const pinned = withPinned(TWO, [{ slot: 2 }, { slot: 2 }, ...many]);

    expect(Object.keys(accented.accents ?? {})).toEqual(
      many.slice(5).map(({ channel }) => `0.${channel}`)
    );
    expect(pinned.pinned).toEqual([
      '2.primary',
      ...many.slice(0, 7).map(({ channel }) => `0.${channel}`),
    ]);
  });

  it('forgets the accents and pins of a slot that signed out', () => {
    const dressed = withPinned(withAccent(withAccent(TWO, { slot: 2 }, 4), { slot: 0 }, 3), [
      { slot: 2 },
      { slot: 0 },
    ]);

    expect(withoutSlot(dressed, 2)).toMatchObject({
      accents: { '0.primary': 3 },
      pinned: ['0.primary'],
    });
  });

  it('marks one slot expired and leaves the others as they were', () => {
    expect(withExpired(TWO, 2).slots.map(({ expired }) => expired)).toEqual([false, true]);
  });

  it.each([
    { removed: 2, defaultSlot: 0, left: [0] },
    { removed: 0, defaultSlot: 2, left: [2] },
  ])('drops slot $removed, defaulting to $defaultSlot', ({ removed, defaultSlot, left }) => {
    const accounts = withoutSlot(TWO, removed);

    expect(accounts.defaultSlot).toBe(defaultSlot);
    expect(accounts.slots.map(({ slot }) => slot)).toEqual(left);
  });

  it('remembers the identity a tab switched to as the default', () => {
    const accounts = withDefault(TWO, 0, 'second');

    expect(accounts.defaultSlot).toBe(0);
    expect(accounts.slots[0]?.channel).toBe('second');
  });

  it.each([
    { userId: 'user-2', slot: 2 },
    { userId: 'stranger', slot: undefined },
  ])('finds $userId in slot $slot, signed in or expired', ({ userId, slot }) => {
    expect(slotOfUser(withExpired(TWO, 2), userId)).toBe(slot);
  });

  it.each([
    { scenario: 'nothing held', accounts: NO_ACCOUNTS, occupied: [], max: 10, free: 0 },
    { scenario: 'a gap', accounts: NO_ACCOUNTS, occupied: [0, 1, 3], max: 10, free: 2 },
    {
      scenario: 'an expired row in the gap, kept',
      accounts: withExpired(signedIn(TWO, 1), 1),
      occupied: [0, 2],
      max: 10,
      free: 3,
    },
    {
      scenario: 'only expired rows left, the lowest replaced',
      accounts: withExpired(signedIn(TWO, 1), 1),
      occupied: [0, 2],
      max: 3,
      free: 1,
    },
    {
      scenario: 'the cap reached',
      accounts: NO_ACCOUNTS,
      occupied: [0, 1],
      max: 2,
      free: undefined,
    },
    {
      scenario: 'every slot held',
      accounts: NO_ACCOUNTS,
      occupied: Array.from({ length: 10 }, (_, slot) => slot),
      max: 10,
      free: undefined,
    },
  ])('adds into slot $free with $scenario', ({ accounts, occupied, max, free }) => {
    expect(firstFreeSlot(accounts, occupied, max)).toBe(free);
  });

  it.each([
    { occupied: [0, 2], slot: 2 },
    { occupied: [0, 3], slot: 0 },
    { occupied: [], slot: 0 },
  ])('opens a tab with no prefix on slot $slot of $occupied', ({ occupied, slot }) => {
    expect(defaultSlotOf(TWO, occupied)).toBe(slot);
  });

  it.each(['not json', '{"defaultSlot":12,"slots":[]}', undefined])(
    'reads %s as no accounts',
    (raw) => {
      expect(parseAccounts(raw)).toEqual(NO_ACCOUNTS);
    }
  );
});
