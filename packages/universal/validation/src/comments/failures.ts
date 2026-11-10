import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';

export type InvalidReportNote = InvalidField<LengthBounds>;

export function invalidReportNote(bounds: LengthBounds): InvalidReportNote {
  return invalidLength('note', bounds);
}

export type InvalidCommentContent = InvalidField<LengthBounds>;

export function invalidCommentContent(bounds: LengthBounds): InvalidCommentContent {
  return invalidLength('content', bounds);
}

export interface CommentSettingsConstraint {
  readonly min?: number;
  readonly max?: number;
  readonly allowed?: readonly number[];
}

export type InvalidCommentSettings = InvalidField<CommentSettingsConstraint>;

export function invalidCommentSettings(
  field: 'blockedWords' | 'linkAllowlist' | 'slowModeSeconds' | 'minAccountAgeDays',
  message: string,
  constraint: CommentSettingsConstraint
): InvalidCommentSettings {
  return invalidField(field, message, constraint);
}

export interface RestrictionConstraint {
  readonly max?: number;
}

export type InvalidRestriction = InvalidField<RestrictionConstraint>;

export function invalidRestriction(
  field: 'reason' | 'expiresAt' | 'userId',
  message: string,
  constraint: RestrictionConstraint
): InvalidRestriction {
  return invalidField(field, message, constraint);
}
