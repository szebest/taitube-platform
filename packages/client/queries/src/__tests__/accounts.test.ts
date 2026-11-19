import {
  type Accounts,
  NO_ACCOUNTS,
  defaultSlotOf,
  firstFreeSlot,
  parseAccounts,
  slotOfUser,
  withDefault,
  withExpired,
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

  it('keeps a label short and an avatar only when it fits the cookie', () => {
    const [entry] = withSignedIn(NO_ACCOUNTS, {
      slot: 0,
      userId: 'u',
      label: 'x'.repeat(100),
      avatarUrl: `https://cdn.example/${'a'.repeat(300)}`,
    }).slots;

    expect(entry).toMatchObject({ avatarUrl: null, expired: false, channel: null });
    expect(entry?.label).toHaveLength(40);
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
    { userId: 'user-2', occupied: [0, 2], slot: 2 },
    { userId: 'user-2', occupied: [0], slot: undefined },
    { userId: 'stranger', occupied: [0, 2], slot: undefined },
  ])('finds $userId in slot $slot of $occupied', ({ userId, occupied, slot }) => {
    expect(slotOfUser(TWO, userId, occupied)).toBe(slot);
  });

  it.each([
    { occupied: [], max: 10, free: 0 },
    { occupied: [0, 1, 3], max: 10, free: 2 },
    { occupied: [0, 1], max: 2, free: undefined },
    { occupied: Array.from({ length: 10 }, (_, slot) => slot), max: 10, free: undefined },
  ])('takes slot $free with $occupied held and a cap of $max', ({ occupied, max, free }) => {
    expect(firstFreeSlot(occupied, max)).toBe(free);
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
