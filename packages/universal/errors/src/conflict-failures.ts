import { ErrorCodes } from './error-codes';
import type { Failure } from './failure';

/**
 * Failures a store reports because a constraint said no. They live here rather than in
 * `@vp/domain-rules` because `@vp/core` has to name them in a port signature and both packages are
 * T3, where a sibling edge is forbidden. They are also genuinely storage vocabulary: a unique index
 * is what produces them.
 */
export type HandleTaken = Failure<typeof ErrorCodes.HANDLE_ALREADY_TAKEN, { handle: string }>;

export type CategorySlugConflict = Failure<
  typeof ErrorCodes.CATEGORY_SLUG_CONFLICT,
  { slug: string }
>;

export type VersionConflict = Failure<
  typeof ErrorCodes.VERSION_CONFLICT,
  { id: string; expectedVersion?: number }
>;

export type ConflictFailure = HandleTaken | CategorySlugConflict | VersionConflict;

export function handleTaken(handle: string): HandleTaken {
  return {
    code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    message: `Handle "${handle}" is already taken`,
    handle,
  };
}

export function categorySlugConflict(slug: string): CategorySlugConflict {
  return {
    code: ErrorCodes.CATEGORY_SLUG_CONFLICT,
    message: `A category with slug "${slug}" already exists`,
    slug,
  };
}

export function versionConflict(id: string, expectedVersion?: number): VersionConflict {
  return {
    code: ErrorCodes.VERSION_CONFLICT,
    message: 'The record was modified by another request',
    id,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  };
}
