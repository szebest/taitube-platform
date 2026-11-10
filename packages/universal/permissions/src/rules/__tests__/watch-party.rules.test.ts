import { subject } from '@casl/ability';
import { guestUser, standardUser } from '../../__mocks__/fixtures';
import type { WatchPartyResource } from '../../types/index';
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
