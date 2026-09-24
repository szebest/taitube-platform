import { type Problem, problemFor } from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import type { ErrorCodes, Failure } from '@vp/errors';
import { assertNever } from '@vp/result';
import { type PublicVideoFailure, presentPublicVideoFailure } from '../../videos.presenter';

type VideoQuarantined = Failure<typeof ErrorCodes.QUOTA_EXCEEDED, { videoId: string }>;
type Grown = PublicVideoFailure | VideoQuarantined;

declare const grown: Grown;

function _rejectsAVariantTheRouteHasNotDecidedAbout(): Problem {
  // @ts-expect-error a rule that grew a variant no longer fits the presenter's parameter
  return presentPublicVideoFailure(grown, '/v1/videos/v1');
}

/**
 * The same presenter written over the grown union: the new variant still reaches `default`, so
 * `failure` is not `never` and the file stops compiling until someone says what it looks like
 * over HTTP. The exhaustiveness guarantee is asserted by the compiler rather than at runtime.
 */
function _presentGrownVideoFailure(failure: Grown, instance: string): Problem {
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
      // @ts-expect-error QUOTA_EXCEEDED still reaches the default branch, so this is not `never`
      return assertNever(failure, 'presentGrownVideoFailure');
  }
}
