import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decidePostPendingLimit } from '../pending-limit.rule';

describe('@vp/domain-rules: decidePostPendingLimit', () => {
  it.each([0, 1, 49])('allows another with %i held', (pending) => {
    expect(isOk(decidePostPendingLimit(pending))).toBe(true);
  });

  it.each([50, 51])('refuses another with %i held', (pending) => {
    const result = decidePostPendingLimit(pending);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_DRAFT_LIMIT,
      limit: 50,
    });
  });
});
