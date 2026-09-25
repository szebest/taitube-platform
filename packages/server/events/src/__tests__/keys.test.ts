import { CacheKeys } from '../keys';

describe('@vp/events cache keys', () => {
  it.each([
    [CacheKeys.categories, 'taitube:cache:categories:v1'],
    [CacheKeys.categoriesInvalidated, 'taitube:events:cache:categories:invalidated'],
    [CacheKeys.publicFeed('trending:20'), 'taitube:feed:public:trending:20'],
    [CacheKeys.videoReactionCounts('v1'), 'taitube:video:v1:reactions'],
    [CacheKeys.userReactions('u1'), 'taitube:user:u1:reactions'],
    [CacheKeys.userReaction('u1', 'v1'), 'taitube:user:u1:reactions:v1'],
    [CacheKeys.userSubscriptions('u1'), 'taitube:user:u1:subscriptions'],
    [CacheKeys.userPlayhead('u1', 'v1'), 'taitube:user:u1:playhead:v1'],
    [CacheKeys.channelSubscriberCount('c1'), 'taitube:channel:c1:subscriber_count'],
    [CacheKeys.viewBuffer, 'taitube:views:buffer'],
    [CacheKeys.viewFlushPointer, 'taitube:views:flushing'],
    [CacheKeys.viewFlushBatch('b1'), 'taitube:views:flush:b1'],
    [CacheKeys.viewDedup('v1', '2026-03-10'), 'taitube:views:dedup:v1:20260310'],
    [CacheKeys.videoHotComments('v1'), 'taitube:video:v1:comments:top'],
  ])('builds %s', (key, expected) => {
    expect(key).toBe(expected);
  });
});
