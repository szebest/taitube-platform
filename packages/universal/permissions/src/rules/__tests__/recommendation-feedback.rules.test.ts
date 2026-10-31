import { subject } from '@casl/ability';
import { guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineRecommendationFeedbackRules } from '../recommendation-feedback.rules';
import { buildAbility } from './build-ability';

describe('rules/recommendation-feedback.rules', () => {
  it.each<{ scenario: string; user: UserContext | null; ownerId: string; expected: boolean }>([
    { scenario: 'an anonymous caller', user: guestUser, ownerId: 'usr-1', expected: false },
    {
      scenario: 'a guest-role caller',
      user: { id: 'guest-1', role: 'GUEST' },
      ownerId: 'guest-1',
      expected: false,
    },
    { scenario: 'the owner', user: standardUser, ownerId: 'usr-1', expected: true },
    { scenario: 'a signed-in stranger', user: standardUser, ownerId: 'usr-2', expected: false },
  ])('$scenario on the feedback of $ownerId: $expected', ({ user, ownerId, expected }) => {
    const ability = buildAbility(defineRecommendationFeedbackRules, user);
    const feedback = subject('RecommendationFeedback', { ownerId });

    expect(ability.can('read', feedback)).toBe(expected);
    expect(ability.can('create', feedback)).toBe(expected);
    expect(ability.can('delete', feedback)).toBe(expected);
  });
});
