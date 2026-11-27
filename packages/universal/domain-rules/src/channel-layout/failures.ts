import type { Failure } from '@kit/errors';
import type { LayoutLimit } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';

export type LayoutLimitExceeded = Failure<
  typeof ErrorCodes.LAYOUT_LIMIT_EXCEEDED,
  { limit: LayoutLimit; max: number; actual: number }
>;

export type LayoutStructureReason =
  | 'duplicate_tab'
  | 'duplicate_section'
  | 'built_in_missing'
  | 'built_in_repeated'
  | 'pinned_tab_hidden'
  | 'landing_unknown'
  | 'see_all_unknown'
  | 'links_invalid';

export type LayoutStructureInvalid = Failure<
  typeof ErrorCodes.LAYOUT_STRUCTURE_INVALID,
  { reason: LayoutStructureReason; id: string }
>;

export type LayoutSlugReason = 'format' | 'reserved' | 'taken' | 'changed';

export type LayoutSlugInvalid = Failure<
  typeof ErrorCodes.LAYOUT_SLUG_INVALID,
  { slug: string; reason: LayoutSlugReason }
>;

export type LayoutReferenceKind = 'video' | 'playlist' | 'post' | 'channel';

export type LayoutReferenceInvalid = Failure<
  typeof ErrorCodes.LAYOUT_REFERENCE_INVALID,
  { kind: LayoutReferenceKind; id: string }
>;

export type LayoutScheduleInvalid = Failure<
  typeof ErrorCodes.LAYOUT_SCHEDULE_INVALID,
  { reason: 'in_past' }
>;

export type LayoutScheduleNotFound = Failure<
  typeof ErrorCodes.LAYOUT_SCHEDULE_NOT_FOUND,
  { scheduleId: string }
>;

export type LayoutRevisionNotFound = Failure<
  typeof ErrorCodes.REVISION_NOT_FOUND,
  { channelId: string; revisionId: string }
>;

export function layoutRevisionNotFound(
  channelId: string,
  revisionId: string
): LayoutRevisionNotFound {
  return {
    code: ErrorCodes.REVISION_NOT_FOUND,
    message: 'Revision not found',
    channelId,
    revisionId,
  };
}

export function layoutLimitExceeded(
  limit: LayoutLimit,
  max: number,
  actual: number
): LayoutLimitExceeded {
  return {
    code: ErrorCodes.LAYOUT_LIMIT_EXCEEDED,
    message: `The page layout holds at most ${max} (${limit}), it has ${actual}`,
    limit,
    max,
    actual,
  };
}

export function layoutStructureInvalid(
  reason: LayoutStructureReason,
  id: string
): LayoutStructureInvalid {
  return {
    code: ErrorCodes.LAYOUT_STRUCTURE_INVALID,
    message: `The page layout is inconsistent: ${reason}`,
    reason,
    id,
  };
}

export function layoutSlugInvalid(slug: string, reason: LayoutSlugReason): LayoutSlugInvalid {
  return {
    code: ErrorCodes.LAYOUT_SLUG_INVALID,
    message: `The tab address "${slug}" is not usable: ${reason}`,
    slug,
    reason,
  };
}

export function layoutReferenceInvalid(
  kind: LayoutReferenceKind,
  id: string
): LayoutReferenceInvalid {
  return {
    code: ErrorCodes.LAYOUT_REFERENCE_INVALID,
    message: `A section points at a ${kind} that is missing, private or not the channel's`,
    kind,
    id,
  };
}

export function layoutScheduleInvalid(): LayoutScheduleInvalid {
  return {
    code: ErrorCodes.LAYOUT_SCHEDULE_INVALID,
    message: 'A layout can only be scheduled for a time in the future',
    reason: 'in_past',
  };
}

export function layoutScheduleNotFound(scheduleId: string): LayoutScheduleNotFound {
  return {
    code: ErrorCodes.LAYOUT_SCHEDULE_NOT_FOUND,
    message: 'Scheduled page change not found',
    scheduleId,
  };
}
