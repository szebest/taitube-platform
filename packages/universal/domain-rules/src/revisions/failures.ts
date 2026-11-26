import { type Failure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

export type RevisionNotFound = Failure<
  typeof ErrorCodes.REVISION_NOT_FOUND,
  { videoId: string; revisionId: string }
>;

export function revisionNotFound(videoId: string, revisionId: string): RevisionNotFound {
  return {
    code: ErrorCodes.REVISION_NOT_FOUND,
    message: 'Revision not found',
    videoId,
    revisionId,
  };
}
