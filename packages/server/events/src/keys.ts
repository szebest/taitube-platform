const NAMESPACE = 'taitube';

export const CacheKeys = {
  categories: `${NAMESPACE}:cache:categories:v1`,
  categoriesInvalidated: `${NAMESPACE}:events:cache:categories:invalidated`,
  publicFeed: (variant: string) => `${NAMESPACE}:feed:public:${variant}`,
  videoReactionCounts: (videoId: string) => `${NAMESPACE}:video:${videoId}:reactions`,
  videoHotComments: (videoId: string) => `${NAMESPACE}:video:${videoId}:comments:top`,
  userReactions: (userId: string) => `${NAMESPACE}:user:${userId}:reactions`,
  userReaction: (userId: string, videoId: string) =>
    `${NAMESPACE}:user:${userId}:reactions:${videoId}`,
  userSubscriptions: (userId: string) => `${NAMESPACE}:user:${userId}:subscriptions`,
  channelSubscriberCount: (channelId: string) =>
    `${NAMESPACE}:channel:${channelId}:subscriber_count`,
} as const;
