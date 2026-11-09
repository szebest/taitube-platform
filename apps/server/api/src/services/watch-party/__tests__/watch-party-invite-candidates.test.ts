import {
  type CandidatePerson,
  INVITE_CANDIDATES,
  pickCandidates,
} from '../watch-party-invite-candidates';

const person = (n: number, overrides: Partial<CandidatePerson> = {}): CandidatePerson => ({
  userId: `user-${n}`,
  handle: `handle${n}`,
  displayName: `Name ${n}`,
  avatarUrl: null,
  ...overrides,
});

const pick = (sources: Partial<Parameters<typeof pickCandidates>[0]> = {}) =>
  pickCandidates({
    selfId: 'user-0',
    prefix: null,
    coWatchers: [],
    subscriptions: [],
    matches: [],
    inRoom: new Set(),
    invited: new Set(),
    ...sources,
  }).map(({ userId, reason }) => [userId, reason]);

describe('pickCandidates', () => {
  it('names people from recent parties, then subscriptions, then matches', () => {
    expect(
      pick({
        coWatchers: [person(1)],
        subscriptions: [person(2)],
        matches: [person(3)],
      })
    ).toEqual([
      ['user-1', 'co_watcher'],
      ['user-2', 'subscription'],
      ['user-3', 'match'],
    ]);
  });

  it('names a person once, under the first reason, and never the caller', () => {
    expect(
      pick({
        coWatchers: [person(1), person(0)],
        subscriptions: [person(1), person(2)],
        matches: [person(2), person(0)],
      })
    ).toEqual([
      ['user-1', 'co_watcher'],
      ['user-2', 'subscription'],
    ]);
  });

  it.each([
    { prefix: 'han', kept: ['user-1', 'user-2'] },
    { prefix: 'name 2', kept: ['user-2'] },
    { prefix: 'nobody', kept: [] },
  ])('narrows recent parties and subscriptions to what "$prefix" starts', ({ prefix, kept }) => {
    const listed = pick({
      prefix,
      coWatchers: [person(1, { displayName: 'Ann' })],
      subscriptions: [person(2)],
    });

    expect(listed.map(([userId]) => userId)).toEqual(kept);
  });

  it('keeps every match, which the search already narrowed', () => {
    expect(
      pick({ prefix: 'x', matches: [person(1, { handle: 'other', displayName: 'Other' })] })
    ).toEqual([['user-1', 'match']]);
  });

  it('flags who is in the room and who is invited', () => {
    const [candidate] = pickCandidates({
      selfId: 'user-0',
      prefix: null,
      coWatchers: [person(1)],
      subscriptions: [],
      matches: [],
      inRoom: new Set(['user-1']),
      invited: new Set(['user-1']),
    });

    expect(candidate).toMatchObject({ inRoom: true, invited: true, handle: 'handle1' });
  });

  it('answers no more than the limit', () => {
    const many = Array.from({ length: INVITE_CANDIDATES + 5 }, (_, n) => person(n + 1));

    expect(pick({ matches: many })).toHaveLength(INVITE_CANDIDATES);
  });
});
