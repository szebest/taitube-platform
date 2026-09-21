import { byKeysetDesc, isKeysetBefore } from '../keyset';

const older = { sort: new Date('2024-05-01T00:00:00.000Z'), tie: 'b' };
const newer = { sort: new Date('2024-05-02T00:00:00.000Z'), tie: 'a' };
const tiedHigh = { sort: older.sort, tie: 'c' };

describe('adapters/in-memory: keyset order', () => {
  it('sorts newest first and breaks ties on the tiebreaker descending', () => {
    expect([older, newer, tiedHigh].sort(byKeysetDesc)).toEqual([newer, tiedHigh, older]);
  });

  it.each([
    { name: 'an older row', row: older, expected: true },
    { name: 'a newer row', row: newer, expected: false },
    { name: 'the cursor row itself', row: tiedHigh, expected: false },
  ])('places $name relative to the cursor', ({ row, expected }) => {
    expect(isKeysetBefore(row, tiedHigh)).toBe(expected);
  });

  it.each([
    { name: 'an absent cursor', cursor: undefined },
    { name: 'a null cursor', cursor: null },
  ])('keeps every row for $name', ({ cursor }) => {
    expect(isKeysetBefore(newer, cursor)).toBe(true);
    expect(isKeysetBefore(older, cursor)).toBe(true);
  });
});
