import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { STRANGER } from '../../__tests__/entities';
import { decideRecommendationFeedbackAccess } from '../recommendation-feedback-access.rule';

const GUEST_ROLE: UserContext = { id: 'guest-1', role: 'GUEST' };

describe('@vp/domain-rules: decideRecommendationFeedbackAccess', () => {
  it.each(['read', 'create', 'delete'] as const)(
    'lets a signed-in caller %s their own',
    (action) => {
      expectOk(
        decideRecommendationFeedbackAccess({ actor: STRANGER, ownerId: STRANGER.id, action })
      );
    }
  );

  it.each([
    { scenario: 'no token', actor: null, ownerId: 'x', code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a guest role',
      actor: GUEST_ROLE,
      ownerId: GUEST_ROLE.id,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'another user',
      actor: STRANGER,
      ownerId: 'someone-else',
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ actor, ownerId, code }) => {
    expect(
      expectErr(decideRecommendationFeedbackAccess({ actor, ownerId, action: 'create' })).code
    ).toBe(code);
  });
});
