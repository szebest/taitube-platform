import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import {
  postAlreadyVoted,
  postDailyLimit,
  postDraftLimit,
  postImageNotReady,
  postNotFound,
  postPinLimit,
  postPollClosed,
  postPollLocked,
  postRevisionNotFound,
  postScheduleInvalid,
  postShareNotPublic,
} from '../failures';

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
    {
      name: 'a second vote',
      failure: postAlreadyVoted('p'),
      expected: { code: ErrorCodes.POST_ALREADY_VOTED, postId: 'p' },
    },
    {
      name: 'a closed poll',
      failure: postPollClosed('p'),
      expected: { code: ErrorCodes.POST_POLL_CLOSED, postId: 'p' },
    },
    {
      name: 'a missing revision',
      failure: postRevisionNotFound('p', 'r'),
      expected: { code: ErrorCodes.REVISION_NOT_FOUND, postId: 'p', revisionId: 'r' },
    },
    {
      name: 'a locked poll',
      failure: postPollLocked('p'),
      expected: { code: ErrorCodes.POST_POLL_LOCKED, postId: 'p' },
    },
    {
      name: 'the pin limit',
      failure: postPinLimit(3),
      expected: { code: ErrorCodes.POST_PIN_LIMIT, limit: 3 },
    },
    {
      name: 'the draft limit',
      failure: postDraftLimit(50),
      expected: { code: ErrorCodes.POST_DRAFT_LIMIT, limit: 50 },
    },
    {
      name: 'an invalid schedule',
      failure: postScheduleInvalid('in_past'),
      expected: { code: ErrorCodes.POST_SCHEDULE_INVALID, reason: 'in_past' },
    },
    {
      name: 'an image that is not ready',
      failure: postImageNotReady('u'),
      expected: { code: ErrorCodes.POST_IMAGE_NOT_READY, uploadId: 'u' },
    },
  ])('builds $name with its code and payload, as a domain failure', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
    expect(isInputFailure(failure)).toBe(false);
  });
});
