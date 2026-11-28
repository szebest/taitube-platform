import { subject } from '@casl/ability';
import { guestUser, moderatorUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext, WatchPartyResource } from '../../types/index';
import { defineWatchPartyRules } from '../watch-party.rules';
import { buildAbility } from './build-ability';

describe('rules/watch-party: creating and reading a room', () => {
  it.each([
    { who: 'a signed-in account', user: standardUser, create: true },
    { who: 'a signed-out visitor', user: guestUser, create: false },
  ])('$who may create a room: $create', ({ user, create }) => {
    expect(buildAbility(defineWatchPartyRules, user).can('create', 'WatchParty')).toBe(create);
  });

  it.each<{ scenario: string; room: WatchPartyResource; read: boolean }>([
    { scenario: 'a public room', room: { visibility: 'public' }, read: true },
    { scenario: 'an unlisted room', room: { visibility: 'unlisted' }, read: true },
    { scenario: 'a private room', room: { visibility: 'private' }, read: false },
    {
      scenario: 'a private room as a member',
      room: { visibility: 'private', isMember: true },
      read: true,
    },
    {
      scenario: 'a private room with a grant',
      room: { visibility: 'private', hasGrant: true },
      read: true,
    },
  ])('a visitor may read $scenario: $read', ({ room, read }) => {
    const ability = buildAbility(defineWatchPartyRules, guestUser);

    expect(ability.can('read', subject('WatchParty', { ...room }))).toBe(read);
  });
});

describe('rules/watch-party: reporting and the moderator close', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    room: WatchPartyResource;
    report: boolean;
  }>([
    { scenario: 'a public room', user: standardUser, room: { visibility: 'public' }, report: true },
    {
      scenario: 'an unlisted room',
      user: standardUser,
      room: { visibility: 'unlisted' },
      report: false,
    },
    {
      scenario: 'an unlisted room they are in',
      user: standardUser,
      room: { visibility: 'unlisted', isMember: true },
      report: true,
    },
    {
      scenario: 'a public room signed out',
      user: guestUser,
      room: { visibility: 'public' },
      report: false,
    },
  ])('reporting $scenario: $report', ({ user, room, report }) => {
    const ability = buildAbility(defineWatchPartyRules, user);

    expect(ability.can('report', subject('WatchParty', { ...room }))).toBe(report);
  });

  it.each([
    { who: 'a moderator', user: moderatorUser, allowed: true },
    { who: 'a signed-in account', user: standardUser, allowed: false },
    { who: 'a signed-out visitor', user: guestUser, allowed: false },
  ])('$who may close and restore any room: $allowed', ({ user, allowed }) => {
    const ability = buildAbility(defineWatchPartyRules, user);

    expect([ability.can('close', 'WatchParty'), ability.can('restore', 'WatchParty')]).toEqual([
      allowed,
      allowed,
    ]);
  });
});
