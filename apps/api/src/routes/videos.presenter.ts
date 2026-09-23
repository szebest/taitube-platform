import { type Problem, problemFor } from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import { assertNever } from '@vp/result';
import type { ReadVideoServiceFailure, UpdateVideoServiceFailure } from '../services/video-service';

export type PublicVideoFailure = ReadVideoServiceFailure | UpdateVideoServiceFailure;

/**
 * The public answer to "you may not read this" is the answer to "it does not exist", byte for byte:
 * a private video has to be indistinguishable from a missing one, or the 403 itself confirms the id.
 * An anonymous caller still gets 401, because that one they can act on.
 *
 * `admin/videos.ts` renders the same `FORBIDDEN`, from the same `VideoService.get` call, as a
 * detailed 403. `VideoService` has no branch for either, which is the property ADR-24 provides.
 */
export function presentPublicVideoFailure(failure: PublicVideoFailure, instance: string): Problem {
  switch (failure.code) {
    case 'FORBIDDEN':
      return problemFor(publicReadFailure(failure), instance);
    case 'VIDEO_NOT_FOUND':
    case 'UNAUTHORIZED':
    case 'VALIDATION_FAILED':
    case 'VERSION_CONFLICT':
    case 'DATABASE_UNAVAILABLE':
      return problemFor(failure, instance);
    default:
      return assertNever(failure, 'presentPublicVideoFailure');
  }
}
