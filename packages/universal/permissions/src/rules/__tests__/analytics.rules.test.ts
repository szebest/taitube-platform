import { subject } from '@casl/ability';
import { creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineAnalyticsRules } from '../analytics.rules';
import { buildAbility } from './build-ability';

describe('rules/analytics.rules: Declarative Analytics Ability Rules', () => {
  it.each<{ scenario: string; user: UserContext | null; ownerId: string; expected: boolean }>([
    { scenario: 'an anonymous caller', user: guestUser, ownerId: 'creator-1', expected: false },
    {
      scenario: 'a guest-role caller',
      user: { id: 'guest-1', role: 'GUEST' },
      ownerId: 'guest-1',
      expected: false,
    },
    { scenario: 'the owner', user: creatorUser, ownerId: 'creator-1', expected: true },
    { scenario: 'a signed-in stranger', user: standardUser, ownerId: 'creator-1', expected: false },
  ])('$scenario reading analytics of $ownerId: $expected', ({ user, ownerId, expected }) => {
    const ability = buildAbility(defineAnalyticsRules, user);

    expect(ability.can('read', subject('Analytics', { ownerId }))).toBe(expected);
  });
});
