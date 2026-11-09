import { api } from '@vp/web-testing';
import { commentsQueryOptions, repliesQueryOptions } from '../comment-keys';

describe('apps/client/web: comment queries', () => {
  it('keys a video comments by the video and the sort', () => {
    const keys = [
      commentsQueryOptions(api, 'a', 'top').queryKey,
      commentsQueryOptions(api, 'a', 'newest').queryKey,
      commentsQueryOptions(api, 'b', 'top').queryKey,
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(3);
  });

  it('keys the replies by the comment', () => {
    expect(repliesQueryOptions(api, 'a').queryKey).not.toEqual(
      repliesQueryOptions(api, 'b').queryKey
    );
  });
});
