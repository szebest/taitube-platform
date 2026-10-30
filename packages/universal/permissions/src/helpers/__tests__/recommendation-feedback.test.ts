import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import {
  canCreateRecommendationFeedback,
  canDeleteRecommendationFeedback,
  canReadRecommendationFeedback,
} from '../recommendation-feedback';

describe('helpers/recommendation-feedback', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, expected: false },
    { scenario: 'the owner', user: standardUser, expected: true },
    { scenario: 'another user', user: creatorUser, expected: false },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    const feedback = { ownerId: standardUser.id };

    expect(canReadRecommendationFeedback({ user, feedback })).toBe(expected);
    expect(canCreateRecommendationFeedback({ user, feedback })).toBe(expected);
    expect(canDeleteRecommendationFeedback({ user, feedback })).toBe(expected);
  });
});
