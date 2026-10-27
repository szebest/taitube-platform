import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { STRANGER, aComment, aVideo } from '../../__tests__/entities';
import { type ReportCommentInput, decideCommentReport } from '../report-comment.rule';

const video = aVideo();
const comment = aComment();

function input(overrides: Partial<ReportCommentInput> = {}): ReportCommentInput {
  return {
    reporter: STRANGER,
    comment,
    commentId: comment.id,
    video,
    reason: 'spam',
    note: undefined,
    ...overrides,
  };
}

describe('@vp/domain-rules: decideCommentReport', () => {
  it.each([
    { scenario: 'no note', note: undefined, expected: null },
    { scenario: 'a padded note', note: '  link farm ', expected: 'link farm' },
  ])('accepts a report with $scenario', ({ note, expected }) => {
    const result = decideCommentReport(input({ note }));

    expect(isOk(result) && result.value).toEqual({ comment, reason: 'spam', note: expected });
  });

  it.each([
    {
      scenario: 'an anonymous caller',
      overrides: { reporter: null },
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      scenario: 'an absent comment',
      overrides: { comment: null },
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
    {
      scenario: 'a comment under a private video',
      overrides: { video: aVideo({ visibility: 'private' }) },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a note over the ceiling',
      overrides: { note: 'a'.repeat(501) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ overrides, code }) => {
    const result = decideCommentReport(input(overrides));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
