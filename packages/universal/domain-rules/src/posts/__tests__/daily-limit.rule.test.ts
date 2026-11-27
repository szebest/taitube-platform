import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decidePostDailyLimit } from '../daily-limit.rule';

describe('@vp/domain-rules: decidePostDailyLimit', () => {
  it.each([0, 1, 19])('allows a channel with %i posts today', (createdToday) => {
    expect(isOk(decidePostDailyLimit(createdToday))).toBe(true);
  });

  it.each([20, 21])('refuses a channel with %i posts today', (createdToday) => {
    const result = decidePostDailyLimit(createdToday);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_DAILY_LIMIT,
      limit: 20,
    });
  });
});
