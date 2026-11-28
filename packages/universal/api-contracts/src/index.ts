import * as accountSecurity from './account-security';
import * as adminCategories from './admin-categories';
import * as adminDlq from './admin-dlq';
import * as adminVideos from './admin-videos';
import * as analytics from './analytics';
import * as apiTokens from './api-tokens';
import * as bootstrap from './bootstrap';
import * as captions from './captions';
import * as categories from './categories';
import * as channelFeatured from './channel-featured';
import * as channelIdentity from './channel-identity';
import * as channelPlaylists from './channel-playlists';
import * as channelRestrictions from './channel-restrictions';
import * as channelTeam from './channel-team';
import * as channelVideos from './channel-videos';
import * as channels from './channels';
import * as clips from './clips';
import * as commentModeration from './comment-moderation';
import * as commentRemovals from './comment-removals';
import * as commentReports from './comment-reports';
import * as commentSettings from './comment-settings';
import * as comments from './comments';
import * as creatorComments from './creator-comments';
import * as creatorLive from './creator-live';
import * as creatorStats from './creator-stats';
import * as creatorVideos from './creator-videos';
import * as events from './events';
import * as channelExports from './exports';
import * as feed from './feed';
import * as health from './health';
import * as live from './live';
import * as liveChat from './live-chat';
import * as liveCompanion from './live-companion';
import * as liveIngest from './live-ingest';
import * as me from './me';
import * as myChannels from './my-channels';
import * as notifications from './notifications';
import * as oembed from './oembed';
import * as picks from './picks';
import * as playback from './playback';
import * as playlistActivity from './playlist-activity';
import * as playlistCollaboration from './playlist-collaboration';
import * as playlistCover from './playlist-cover';
import * as playlistItems from './playlist-items';
import * as playlistLibrary from './playlist-library';
import * as playlistSharing from './playlist-sharing';
import * as playlistTransfer from './playlist-transfer';
import * as playlists from './playlists';
import * as postRevisions from './post-revisions';
import * as postStudio from './post-studio';
import * as posts from './posts';
import * as preferences from './preferences';
import * as reactions from './reactions';
import * as recommendationFeedback from './recommendation-feedback';
import * as recommendations from './recommendations';
import * as savedReplies from './saved-replies';
import * as screening from './screening';
import * as search from './search';
import * as searchHistory from './search-history';
import * as shorts from './shorts';
import * as subscriptions from './subscriptions';
import * as telemetry from './telemetry';
import * as threads from './threads';
import * as trustedCommenters from './trusted-commenters';
import * as uploads from './uploads';
import * as videoAccess from './video-access';
import * as videoExperiments from './video-experiments';
import * as videoPipeline from './video-pipeline';
import * as videoTools from './video-tools';
import * as videos from './videos';
import * as viewerActivity from './viewer-activity';
import * as views from './views';
import * as watchHistory from './watch-history';
import * as watchParties from './watch-parties';
import * as watchPartyControls from './watch-party-controls';
import * as watchPartyGuests from './watch-party-guests';
import * as watchPartyInvites from './watch-party-invites';
import * as watchPartyMembers from './watch-party-members';
import * as watchPartyQueue from './watch-party-queue';
import * as watchPartyRoles from './watch-party-roles';
import * as watchPartySocket from './watch-party-socket';
import * as watchPartyVoice from './watch-party-voice';
import * as webhooks from './webhooks';

export * from './account-security';
export * from './admin-categories';
export * from './admin-dlq';
export * from './admin-videos';
export * from './analytics';
export * from './api-tokens';
export * from './bootstrap';
export * from './captions';
export * from './categories';
export * from './channel-featured';
export * from './channel-identity';
export * from './channel-images';
export * from './channel-playlists';
export * from './channel-restrictions';
export * from './channel-team';
export * from './channel-videos';
export * from './channels';
export * from './clips';
export * from './comment-removals';
export * from './comment-reports';
export * from './comment-moderation';
export * from './comment-settings';
export * from './comments';
export * from './creator-comments';
export * from './creator-live';
export * from './creator-stats';
export * from './creator-videos';
export * from './endpoint';
export * from './events';
export * from './exports';
export * from './feed';
export * from './health';
export * from './live';
export * from './live-chat';
export * from './live-companion';
export * from './live-ingest';
export * from './me';
export * from './my-channels';
export * from './notifications';
export * from './oembed';
export * from './pagination';
export * from './picks';
export * from './playback';
export * from './playlist-activity';
export * from './playlist-collaboration';
export * from './playlist-cover';
export * from './playlist-items';
export * from './playlist-library';
export * from './playlist-resource';
export * from './playlist-rules';
export * from './playlist-sharing';
export * from './playlist-transfer';
export * from './playlists';
export * from './post-revisions';
export * from './post-studio';
export * from './posts';
export * from './preferences';
export * from './problem';
export * from './problem-for';
export * from './reactions';
export * from './recommendation-feedback';
export * from './recommendations';
export * from './screening';
export * from './search';
export * from './saved-replies';
export * from './search-history';
export * from './shorts';
export * from './subscriptions';
export * from './telemetry';
export * from './threads';
export * from './trusted-commenters';
export * from './uploads';
export * from './video-resource';
export * from './video-access';
export * from './video-experiments';
export * from './video-pipeline';
export * from './video-tools';
export * from './videos';
export * from './viewer-activity';
export * from './views';
export * from './watch-history';
export * from './watch-parties';
export * from './watch-party-controls';
export * from './watch-party-guests';
export * from './watch-party-invites';
export * from './watch-party-members';
export * from './watch-party-queue';
export * from './watch-party-resource';
export * from './watch-party-roles';
export * from './watch-party-socket';
export * from './watch-party-voice';
export * from './webhooks';

export const contracts = {
  accountSecurity,
  adminCategories,
  adminDlq,
  adminVideos,
  analytics,
  apiTokens,
  bootstrap,
  captions,
  categories,
  channelExports,
  channelFeatured,
  channelIdentity,
  channelPlaylists,
  channelRestrictions,
  channelTeam,
  channelVideos,
  channels,
  clips,
  commentModeration,
  commentRemovals,
  commentReports,
  commentSettings,
  comments,
  creatorComments,
  creatorLive,
  creatorStats,
  creatorVideos,
  events,
  feed,
  health,
  live,
  liveChat,
  liveCompanion,
  liveIngest,
  me,
  myChannels,
  notifications,
  oembed,
  picks,
  playback,
  playlists,
  playlistActivity,
  playlistCollaboration,
  playlistCover,
  playlistItems,
  playlistTransfer,
  postRevisions,
  postStudio,
  posts,
  preferences,
  reactions,
  recommendationFeedback,
  recommendations,
  screening,
  search,
  searchHistory,
  shorts,
  subscriptions,
  telemetry,
  threads,
  savedReplies,
  trustedCommenters,
  uploads,
  videoAccess,
  videoExperiments,
  videoPipeline,
  videoTools,
  videos,
  viewerActivity,
  views,
  watchHistory,
  watchParties,
  watchPartyControls,
  watchPartyGuests,
  watchPartyInvites,
  watchPartyMembers,
  watchPartyQueue,
  watchPartyRoles,
  watchPartySocket,
  watchPartyVoice,
  webhooks,
  playlistLibrary,
  playlistSharing,
} as const;

export function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
