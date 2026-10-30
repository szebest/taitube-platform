import { type InvalidField, invalidLength, type LengthBounds } from '../failures';

export type InvalidReportNote = InvalidField<LengthBounds>;

export function invalidReportNote(bounds: LengthBounds): InvalidReportNote {
  return invalidLength('note', bounds);
}

export type InvalidCommentContent = InvalidField<LengthBounds>;

export function invalidCommentContent(bounds: LengthBounds): InvalidCommentContent {
  return invalidLength('content', bounds);
}
