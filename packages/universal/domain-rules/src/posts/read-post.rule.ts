import { type Result, err, ok } from '@kit/result';
import type { ChannelPost } from '@vp/domain';
import { type PostNotFound, postNotFound } from './failures';
import { POST_LIFECYCLE } from './post-lifecycle.machine';

const PUBLISHED = POST_LIFECYCLE.target('publish');

export interface ReadPostInput {
  readonly post: ChannelPost | null;
  readonly postId: string;
}

/** Anyone reads a published post; a draft or a scheduled one is not there for a reader. */
export function decidePostRead(input: ReadPostInput): Result<ChannelPost, PostNotFound> {
  return input.post?.status === PUBLISHED ? ok(input.post) : err(postNotFound(input.postId));
}
