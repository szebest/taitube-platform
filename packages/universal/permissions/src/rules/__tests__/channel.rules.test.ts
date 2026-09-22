import { subject } from '@casl/ability';
import { creatorUser, guestUser, sampleChannel, standardUser } from '../../__mocks__/fixtures.js';
import type { AppAction, AppSubjects, UserContext } from '../../types/index.js';
import { defineChannelRules } from '../channel.rules';
import { buildAbility } from './build-ability.js';

describe('rules/channel.rules: Declarative Channel Ability Rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a guest reads the channel collection',
      user: guestUser,
      action: 'read',
      target: 'Channel',
      expected: true,
    },
    {
      scenario: 'the channel owner updates it',
      user: standardUser,
      action: 'update',
      target: subject('Channel', sampleChannel),
      expected: true,
    },
    {
      scenario: 'another user updates it',
      user: creatorUser,
      action: 'update',
      target: subject('Channel', sampleChannel),
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineChannelRules, user).can(action, target)).toBe(expected);
  });
});
