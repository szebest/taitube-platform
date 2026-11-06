const NAMESPACE = 'taitube';

export const CacheKeys = {
  categories: `${NAMESPACE}:cache:categories:v1`,
  categoriesInvalidated: `${NAMESPACE}:events:cache:categories:invalidated`,
  currentPick: `${NAMESPACE}:picks:current:v1`,
  publicFeed: (variant: string) => `${NAMESPACE}:feed:public:${variant}`,
  home: (viewer: string) => `${NAMESPACE}:home:${viewer}`,
  videoReactionCounts: (videoId: string) => `${NAMESPACE}:video:${videoId}:reactions`,
  videoHotComments: (videoId: string) => `${NAMESPACE}:video:${videoId}:comments:top`,
  userReactions: (userId: string) => `${NAMESPACE}:user:${userId}:reactions`,
  userReaction: (userId: string, videoId: string) =>
    `${NAMESPACE}:user:${userId}:reactions:${videoId}`,
  userPlayhead: (userId: string, videoId: string) =>
    `${NAMESPACE}:user:${userId}:playhead:${videoId}`,
  userSubscriptions: (userId: string) => `${NAMESPACE}:user:${userId}:subscriptions`,
  channelSubscriberCount: (channelId: string) =>
    `${NAMESPACE}:channel:${channelId}:subscriber_count`,
  searchQuery: (type: string, hash: string) => `${NAMESPACE}:search:q:${type}:${hash}`,
  searchSuggest: (prefix: string) => `${NAMESPACE}:search:suggest:${prefix}`,
  searchCounted: (text: string) => `${NAMESPACE}:search:counted:${text}`,
  viewBuffer: `${NAMESPACE}:views:buffer`,
  viewFlushPointer: `${NAMESPACE}:views:flushing`,
  viewFlushBatch: (batchId: string) => `${NAMESPACE}:views:flush:${batchId}`,
  hourlyViewBuffer: `${NAMESPACE}:views:hourly:buffer`,
  hourlyViewFlushBatch: (batchId: string) => `${NAMESPACE}:views:hourly:flush:${batchId}`,
  retentionBuffer: `${NAMESPACE}:retention:buffer`,
  retentionFlushBatch: (batchId: string) => `${NAMESPACE}:retention:flush:${batchId}`,
  retentionSession: (videoId: string, sessionId: string) =>
    `${NAMESPACE}:retention:session:${videoId}:${sessionId}`,
  viewSession: (videoId: string, sessionId: string) =>
    `${NAMESPACE}:views:session:${videoId}:${sessionId}`,
  liveChatTicket: (ticket: string) => `${NAMESPACE}:live:chat:ticket:${ticket}`,
  liveChatSlowMode: (liveStreamId: string, userId: string) =>
    `${NAMESPACE}:live:${liveStreamId}:chat:slow:${userId}`,
  liveChatBurst: (liveStreamId: string, userId: string) =>
    `${NAMESPACE}:live:${liveStreamId}:chat:burst:${userId}`,
  livePresence: (liveStreamId: string) => `${NAMESPACE}:live:${liveStreamId}:presence`,
  watchPartyTicket: (ticket: string) => `${NAMESPACE}:watch-party:ticket:${ticket}`,
  watchPartyBudget: (budget: string, scope: string) =>
    `${NAMESPACE}:watch-party:budget:${budget}:${scope}`,
  watchPartySlowMode: (roomId: string, memberKey: string) =>
    `${NAMESPACE}:watch-party:${roomId}:slow:${memberKey}`,
  watchPartyRolesVersion: (roomId: string) => `${NAMESPACE}:watch-party:${roomId}:roles-version`,
  watchPartySkipVotes: (roomId: string, itemId: string) =>
    `${NAMESPACE}:watch-party:${roomId}:skip:${itemId}`,
  watchPartyPresence: (roomId: string) => `${NAMESPACE}:watch-party:${roomId}:presence`,
  watchPartyPresenceSince: (roomId: string) => `${NAMESPACE}:watch-party:${roomId}:presence-since`,
  partyGuestSession: (credentialHash: string) => `${NAMESPACE}:watch-party:guest:${credentialHash}`,
  viewDedup: (videoId: string, viewDate: string) =>
    `${NAMESPACE}:views:dedup:${videoId}:${viewDate.replaceAll('-', '')}`,
} as const;
