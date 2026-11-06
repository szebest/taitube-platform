import { admissionLimit, effectiveCapacity, hasSpace } from '../watch-party-capacity';

const CEILING = 200;
const MEMBER = { isOwner: false, joinWhenFull: false };

describe('@vp/domain: watch party capacity', () => {
  it.each([
    { scenario: 'no capacity', capacity: null, shown: 200 },
    { scenario: 'a capacity of 10', capacity: 10, shown: 10 },
    { scenario: 'a capacity left above a lowered ceiling', capacity: 500, shown: 200 },
  ])('shows $shown for $scenario', ({ capacity, shown }) => {
    expect(effectiveCapacity(capacity, CEILING)).toBe(shown);
  });

  it.each([
    { who: 'a member, no capacity', capacity: null, seat: MEMBER, limit: 200 },
    { who: 'a member, capacity 10', capacity: 10, seat: MEMBER, limit: 10 },
    {
      who: 'a joinWhenFull holder, capacity 10',
      capacity: 10,
      seat: { isOwner: false, joinWhenFull: true },
      limit: 200,
    },
    { who: 'the owner', capacity: 10, seat: { isOwner: true, joinWhenFull: true }, limit: null },
  ])('admits $who below $limit', ({ capacity, seat, limit }) => {
    expect(admissionLimit(capacity, CEILING, seat)).toBe(limit);
  });

  it.each([
    { present: 9, limit: 10, space: true },
    { present: 10, limit: 10, space: false },
    { present: 12, limit: 10, space: false },
    { present: 250, limit: null, space: true },
  ])('has space with $present present below $limit: $space', ({ present, limit, space }) => {
    expect(hasSpace(present, limit)).toBe(space);
  });
});
