import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decidePostPinLimit } from '../pin-post.rule';

describe('@vp/domain-rules: decidePostPinLimit', () => {
  it.each([0, 1, 2])('allows a pin with %i pinned', (pinned) => {
    expect(isOk(decidePostPinLimit(pinned))).toBe(true);
  });

  it.each([3, 4])('refuses a pin with %i pinned', (pinned) => {
    const result = decidePostPinLimit(pinned);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_PIN_LIMIT,
      limit: 3,
    });
  });
});
