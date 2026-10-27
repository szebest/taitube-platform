import { ErrorCodes, type Failure } from '@vp/errors';

export type CommentNotFound = Failure<typeof ErrorCodes.COMMENT_NOT_FOUND, { commentId: string }>;

export type CommentNotPinnable = Failure<
  typeof ErrorCodes.COMMENT_NOT_PINNABLE,
  { commentId: string }
>;

export function commentNotFound(commentId: string): CommentNotFound {
  return { code: ErrorCodes.COMMENT_NOT_FOUND, message: 'Comment not found', commentId };
}

export function commentNotPinnable(commentId: string): CommentNotPinnable {
  return {
    code: ErrorCodes.COMMENT_NOT_PINNABLE,
    message: 'Only a top-level comment can be pinned',
    commentId,
  };
}

export type CommentAlreadyReported = Failure<
  typeof ErrorCodes.COMMENT_ALREADY_REPORTED,
  { commentId: string }
>;

export type ReportNotFound = Failure<typeof ErrorCodes.REPORT_NOT_FOUND, { reportId: string }>;

export type ReportAlreadyResolved = Failure<
  typeof ErrorCodes.REPORT_ALREADY_RESOLVED,
  { reportId: string }
>;

export function commentAlreadyReported(commentId: string): CommentAlreadyReported {
  return {
    code: ErrorCodes.COMMENT_ALREADY_REPORTED,
    message: 'You already reported this comment',
    commentId,
  };
}

export function reportNotFound(reportId: string): ReportNotFound {
  return { code: ErrorCodes.REPORT_NOT_FOUND, message: 'Report not found', reportId };
}

export function reportAlreadyResolved(reportId: string): ReportAlreadyResolved {
  return {
    code: ErrorCodes.REPORT_ALREADY_RESOLVED,
    message: 'Report was already resolved',
    reportId,
  };
}
