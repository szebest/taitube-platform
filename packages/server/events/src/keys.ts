import { defineKeyspace } from '@kit/keyspace';

export const CacheKeys = defineKeyspace('taitube', (key) => ({
  categories: key('cache', 'categories', 'v1'),
  categoriesInvalidated: key('events', 'cache', 'categories', 'invalidated'),
  currentPick: key('picks', 'current', 'v1'),
  publicFeed: (variant: string) => key('feed', 'public', variant),
  home: (viewer: string) => key('home', viewer),
  videoReactionCounts: (videoId: string) => key('video', videoId, 'reactions'),
  hotComments: (targetType: string, id: string) => key(targetType, id, 'comments', 'top'),
  userReactions: (userId: string) => key('user', userId, 'reactions'),
  userReaction: (userId: string, videoId: string) => key('user', userId, 'reactions', videoId),
  userPlayhead: (userId: string, videoId: string) => key('user', userId, 'playhead', videoId),
  channelSubscriptions: (subscriberChannelId: string) =>
    key('channel', subscriberChannelId, 'subscriptions'),
  channelSubscriberCount: (channelId: string) => key('channel', channelId, 'subscriber_count'),
  searchQuery: (type: string, hash: string) => key('search', 'q', type, hash),
  searchSuggest: (prefix: string) => key('search', 'suggest', prefix),
  searchCounted: (text: string) => key('search', 'counted', text),
  viewBuffer: key('views', 'buffer'),
  viewFlushPointer: key('views', 'flushing'),
  viewFlushBatch: (batchId: string) => key('views', 'flush', batchId),
  hourlyViewBuffer: key('views', 'hourly', 'buffer'),
  hourlyViewFlushBatch: (batchId: string) => key('views', 'hourly', 'flush', batchId),
  retentionBuffer: key('retention', 'buffer'),
  retentionFlushBatch: (batchId: string) => key('retention', 'flush', batchId),
  retentionSession: (videoId: string, sessionId: string) =>
    key('retention', 'session', videoId, sessionId),
  viewSession: (videoId: string, sessionId: string) => key('views', 'session', videoId, sessionId),
  commentSlowMode: (channelId: string, userId: string) =>
    key('comments', 'slow', channelId, userId),
  postOpens: (postId: string, day: string) => key('posts', postId, 'opens', day),
  liveChatTicket: (ticket: string) => key('live', 'chat', 'ticket', ticket),
  liveChatSlowMode: (liveStreamId: string, userId: string) =>
    key('live', liveStreamId, 'chat', 'slow', userId),
  liveChatBurst: (liveStreamId: string, userId: string) =>
    key('live', liveStreamId, 'chat', 'burst', userId),
  livePresence: (liveStreamId: string) => key('live', liveStreamId, 'presence'),
  watchPartyTicket: (ticket: string) => key('watch-party', 'ticket', ticket),
  watchPartyBudget: (budget: string, scope: string) => key('watch-party', 'budget', budget, scope),
  watchPartySlowMode: (roomId: string, memberKey: string) =>
    key('watch-party', roomId, 'slow', memberKey),
  watchPartyRolesVersion: (roomId: string) => key('watch-party', roomId, 'roles-version'),
  watchPartySkipVotes: (roomId: string, itemId: string) =>
    key('watch-party', roomId, 'skip', itemId),
  watchPartyPresence: (roomId: string) => key('watch-party', roomId, 'presence'),
  watchPartyPresenceSince: (roomId: string) => key('watch-party', roomId, 'presence-since'),
  partyGuestSession: (credentialHash: string) => key('watch-party', 'guest', credentialHash),
  viewDedup: (videoId: string, viewDate: string) =>
    key('views', 'dedup', videoId, viewDate.replaceAll('-', '')),
  shareLinkOpenDedup: (linkId: string, viewDate: string) =>
    key('views', 'link-dedup', linkId, viewDate.replaceAll('-', '')),
  playlistOpenDedup: (playlistId: string, viewDate: string) =>
    key('views', 'playlist-dedup', playlistId, viewDate.replaceAll('-', '')),
  smartPlaylistPage: (playlistId: string, fingerprint: string) =>
    key('playlists', 'smart', playlistId, fingerprint),
}));
