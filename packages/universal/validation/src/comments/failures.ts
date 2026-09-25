import { type InvalidField, type LengthBounds, invalidLength } from '../failures';

export type InvalidCommentContent = InvalidField<LengthBounds>;

export function invalidCommentContent(bounds: LengthBounds): InvalidCommentContent {
  return invalidLength('content', bounds);
}
