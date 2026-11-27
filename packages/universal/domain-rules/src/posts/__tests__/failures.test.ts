import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { postDailyLimit, postNotFound, postShareNotPublic } from '../failures';

describe('@vp/domain-rules: post failures', () => {
  it.each([
    {
      name: 'a missing post',
      failure: postNotFound('post-1'),
      expected: { code: ErrorCodes.POST_NOT_FOUND, postId: 'post-1' },
    },
    {
      name: 'a share that is not public',
      failure: postShareNotPublic('playlist', 'pl-1'),
      expected: { code: ErrorCodes.POST_SHARE_NOT_PUBLIC, shared: 'playlist', id: 'pl-1' },
    },
    {
      name: 'the daily limit',
      failure: postDailyLimit(20),
      expected: { code: ErrorCodes.POST_DAILY_LIMIT, limit: 20 },
    },
  ])('builds $name with its code and payload, as a domain failure', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
    expect(isInputFailure(failure)).toBe(false);
  });
});
