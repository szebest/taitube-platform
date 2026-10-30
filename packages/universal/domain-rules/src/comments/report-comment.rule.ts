import type { Comment, CommentReportReason, Video } from '@vp/domain';
import { canReportComment, type UserContext } from '@vp/permissions';
import { andThen, map, type Result } from '@vp/result';
import { type InvalidReportNote, validateReportNote } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { decideVideoRead, type ReadVideoFailure } from '../videos/index';
import type { CommentNotFound } from './failures';
import { locateComment } from './located-comment';

export interface ReportCommentInput {
  readonly reporter: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly video: Video | null;
  readonly reason: CommentReportReason;
  readonly note: string | undefined;
}

export interface CommentToReport {
  readonly comment: Comment;
  readonly reason: CommentReportReason;
  readonly note: string | null;
}

export type ReportCommentFailure =
  | AuthorizationFailure
  | CommentNotFound
  | ReadVideoFailure
  | InvalidReportNote;

/** A viewer reports what they can see: a comment under a video they may not read is not there. */
export function decideCommentReport(
  input: ReportCommentInput
): Result<CommentToReport, ReportCommentFailure> {
  return andThen(
    authorize(input.reporter, canReportComment({ user: input.reporter }), {
      action: 'report',
      subject: 'Comment',
    }),
    (reporter): Result<CommentToReport, ReportCommentFailure> =>
      andThen(locateComment(input), ({ comment, video }) =>
        andThen(decideVideoRead({ viewer: reporter, video, videoId: video.id }), () =>
          map(validateReportNote(input.note), (note) => ({
            comment,
            reason: input.reason,
            note,
          }))
        )
      )
  );
}
