import { type Result, err, ok } from '@kit/result';
import type { PostPayload } from '@vp/domain';
import { type PostImageNotReady, postImageNotReady } from './failures';

export interface PostImagesInput {
  readonly payload: PostPayload;
  readonly readyUploadIds: ReadonlySet<string>;
}

/** Every image of a post is a ready `post-image` of the posting channel; the caller read `readyUploadIds` for that channel. */
export function decidePostImages(input: PostImagesInput): Result<void, PostImageNotReady> {
  const { payload, readyUploadIds } = input;
  if (payload.kind !== 'images') return ok(undefined);
  const missing = payload.images.find((image) => !readyUploadIds.has(image.uploadId));
  return missing ? err(postImageNotReady(missing.uploadId)) : ok(undefined);
}
