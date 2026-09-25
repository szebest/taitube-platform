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
    [CacheKeys.channelSubscriberCount('c1'), 'taitube:channel:c1:subscriber_count'],
    [CacheKeys.videoHotComments('v1'), 'taitube:video:v1:comments:top'],
  ])('builds %s', (key, expected) => {
    expect(key).toBe(expected);
  });
});
