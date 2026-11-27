import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { aPost } from '../../__tests__/entities';
import { decidePostRead } from '../read-post.rule';

describe('@vp/domain-rules: decidePostRead', () => {
  it('returns a published post', () => {
    const post = aPost();

    const result = decidePostRead({ post, postId: post.id });

    expect(isOk(result) && result.value).toBe(post);
  });

  it.each([
    { scenario: 'a draft', post: aPost({ status: 'draft' }) },
    { scenario: 'a scheduled post', post: aPost({ status: 'scheduled' }) },
    { scenario: 'no post', post: null },
  ])('hides $scenario as not found', ({ post }) => {
    const result = decidePostRead({ post, postId: 'post-1' });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_NOT_FOUND,
      postId: 'post-1',
    });
  });
});
