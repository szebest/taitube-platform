import {
  commentsAccountTooNew,
  commentsBanned,
  commentsDisabled,
  commentsSlowMode,
  commentsSubscribersOnly,
} from '@vp/domain-rules';
import { commentFailureHeaders, presentCommentFailure } from '../comments.presenter';

const URL = '/v1/videos/v1/comments';

describe('apps/server/api/routes: comment failure presenter', () => {
  it.each([
    {
      scenario: 'a ban with its reason and end',
      failure: commentsBanned({ reason: 'spam', expiresAt: new Date('2026-02-01T00:00:00.000Z') }),
      status: 403,
      errors: [{ reason: 'spam', expiresAt: '2026-02-01T00:00:00.000Z' }],
    },
    {
      scenario: 'a permanent ban',
      failure: commentsBanned({ reason: null, expiresAt: null }),
      status: 403,
      errors: [{ reason: null, expiresAt: null }],
    },
    {
      scenario: 'an account that is too new, with the day it opens',
      failure: commentsAccountTooNew(new Date('2026-03-01T00:00:00.000Z')),
      status: 403,
      errors: [{ opensAt: '2026-03-01T00:00:00.000Z' }],
    },
    {
      scenario: 'slow mode, with the seconds to wait',
      failure: commentsSlowMode(12),
      status: 429,
      errors: [{ retryAfter: 12 }],
    },
    {
      scenario: 'comments turned off, with nothing but the code',
      failure: commentsDisabled('v1'),
      status: 403,
      errors: undefined,
    },
    {
      scenario: 'subscribers only, with nothing but the code',
      failure: commentsSubscribersOnly('c1'),
      status: 403,
      errors: undefined,
    },
  ])('presents $scenario', ({ failure, status, errors }) => {
    const problem = presentCommentFailure(failure, URL);

    expect(problem).toMatchObject({ code: failure.code, status, instance: URL });
    expect(problem.errors).toEqual(errors);
  });

  it.each([
    { failure: commentsSlowMode(12), headers: { 'retry-after': '12' } },
    { failure: commentsDisabled('v1'), headers: {} },
  ])('sends $headers for a $failure.code refusal', ({ failure, headers }) => {
    expect(commentFailureHeaders(failure)).toEqual(headers);
  });
});
