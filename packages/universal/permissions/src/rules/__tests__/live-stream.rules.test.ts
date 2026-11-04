import { subject } from '@casl/ability';
import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineLiveStreamRules } from '../live-stream.rules';
import { buildAbility } from './build-ability';

describe('rules/live-stream.rules: who may run a channel broadcast', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'the channel owner', user: standardUser, expected: true },
    { scenario: 'another creator', user: creatorUser, expected: false },
    { scenario: 'a guest', user: guestUser, expected: false },
  ])('$scenario updates the stream: $expected', ({ user, expected }) => {
    const stream = subject('LiveStream', { ownerId: standardUser.id });

    expect(buildAbility(defineLiveStreamRules, user).can('update', stream)).toBe(expected);
  });

  it('leaves the admin grant to the admin rules', () => {
    const stream = subject('LiveStream', { ownerId: 'x' });

    expect(buildAbility(defineLiveStreamRules, adminUser).can('update', stream)).toBe(false);
  });
});
