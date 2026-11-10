import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  commentAlreadyReported,
  commentNotFound,
  commentNotPinnable,
  commentsAccountTooNew,
  commentsBanned,
  commentsDisabled,
  commentsSlowMode,
  commentsSubscribersOnly,
  cannotRestrictMember,
  restrictionNotFound,
  moderationNotApplicable,
  reportAlreadyResolved,
  reportNotFound,
} from '../failures';

describe('@vp/domain-rules: comment failures', () => {
  it.each([
    { name: 'commentNotFound', failure: commentNotFound('c1'), code: ErrorCodes.COMMENT_NOT_FOUND },
    {
      name: 'commentNotPinnable',
      failure: commentNotPinnable('c1'),
      code: ErrorCodes.COMMENT_NOT_PINNABLE,
    },
    {
      name: 'commentAlreadyReported',
      failure: commentAlreadyReported('c1'),
      code: ErrorCodes.COMMENT_ALREADY_REPORTED,
    },
  ])('$name carries $code and the comment id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, commentId: 'c1' });
    expect(isInputFailure(failure)).toBe(false);
  });

  it.each([
    { name: 'reportNotFound', failure: reportNotFound('r1'), code: ErrorCodes.REPORT_NOT_FOUND },
    {
      name: 'reportAlreadyResolved',
      failure: reportAlreadyResolved('r1'),
      code: ErrorCodes.REPORT_ALREADY_RESOLVED,
    },
  ])('$name carries $code and the report id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, reportId: 'r1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});

describe('@vp/domain-rules: comment moderation failures', () => {
  it.each([
    {
      name: 'commentsBanned',
      failure: commentsBanned({ reason: 'spam', expiresAt: new Date('2026-02-01T00:00:00.000Z') }),
      code: ErrorCodes.COMMENTS_BANNED,
      payload: { reason: 'spam', expiresAt: '2026-02-01T00:00:00.000Z' },
    },
    {
      name: 'commentsBanned without an end',
      failure: commentsBanned({ reason: null, expiresAt: null }),
      code: ErrorCodes.COMMENTS_BANNED,
      payload: { reason: null, expiresAt: null },
    },
    {
      name: 'commentsDisabled',
      failure: commentsDisabled('v1'),
      code: ErrorCodes.COMMENTS_DISABLED,
      payload: { videoId: 'v1' },
    },
    {
      name: 'commentsSubscribersOnly',
      failure: commentsSubscribersOnly('ch1'),
      code: ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
      payload: { channelId: 'ch1' },
    },
    {
      name: 'commentsAccountTooNew',
      failure: commentsAccountTooNew(new Date('2026-03-01T00:00:00.000Z')),
      code: ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
      payload: { opensAt: '2026-03-01T00:00:00.000Z' },
    },
    {
      name: 'commentsSlowMode',
      failure: commentsSlowMode(12),
      code: ErrorCodes.COMMENTS_SLOW_MODE,
      payload: { retryAfterSeconds: 12 },
    },
    {
      name: 'moderationNotApplicable',
      failure: moderationNotApplicable('hide', 'held', 'state'),
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
      payload: { action: 'hide', state: 'held', why: 'state' },
    },
  ])('$name carries $code and its payload, off the wire', ({ failure, code, payload }) => {
    expect(failure).toMatchObject({ code, ...payload });
    expect(isInputFailure(failure)).toBe(false);
  });
});

describe('@vp/domain-rules: restriction failures', () => {
  it.each([
    { failure: restrictionNotFound('u1'), code: ErrorCodes.RESTRICTION_NOT_FOUND },
    { failure: cannotRestrictMember('u1'), code: ErrorCodes.CANNOT_RESTRICT_MEMBER },
  ])('$code carries the user id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, userId: 'u1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});
