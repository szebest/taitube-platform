import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, andThen, isErr, ok } from '@kit/result';
import type { PostPayload } from '@vp/domain';
import { type PostImageNotReady, decidePollClose, decidePostImages } from '@vp/domain-rules';
import type { InvalidPostPayload } from '@vp/validation';
import type { PostViewDeps } from './post-views';

export type PayloadCheckFailure = InvalidPostPayload | PostImageNotReady | DatabaseUnavailable;

/**
 * What a payload needs beyond its own shape: a close time inside the window that opens when voting
 * does, and every image a ready
 * post image of the posting channel, which only the repositories can say.
 */
export async function checkPayloadReferences(
  deps: Pick<PostViewDeps, 'images'>,
  channelId: string,
  payload: PostPayload,
  opens: { at: Date; previous: PostPayload | null }
): Promise<Result<void, PayloadCheckFailure>> {
  const closing = decidePollClose(payload, opens.at, opens.previous);
  if (isErr(closing)) return closing;
  if (payload.kind !== 'images') return ok();
  const ready = await deps.images.findReadyPostImages(
    channelId,
    payload.images.map((image) => image.uploadId)
  );
  return andThen(ready, (found) =>
    decidePostImages({
      payload,
      readyUploadIds: new Set(found.map((image) => image.uploadId)),
    })
  );
}
