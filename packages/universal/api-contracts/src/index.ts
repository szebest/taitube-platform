import * as adminCategories from './admin-categories';
import * as adminDlq from './admin-dlq';
import * as adminVideos from './admin-videos';
import * as analytics from './analytics';
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
import * as creatorVideos from './creator-videos';
import * as events from './events';
import * as feed from './feed';
import * as health from './health';
import * as live from './live';
import * as liveChat from './live-chat';
import * as liveCompanion from './live-companion';
import * as liveIngest from './live-ingest';
import * as me from './me';
import * as notifications from './notifications';
import * as oembed from './oembed';
import * as picks from './picks';
import * as playback from './playback';
import * as playlists from './playlists';
import * as preferences from './preferences';
import * as reactions from './reactions';
import * as recommendationFeedback from './recommendation-feedback';
import * as recommendations from './recommendations';
import * as savedReplies from './saved-replies';
import * as search from './search';
import * as searchHistory from './search-history';
import * as shorts from './shorts';
import * as subscriptions from './subscriptions';
import * as telemetry from './telemetry';
import * as trustedCommenters from './trusted-commenters';
import * as uploads from './uploads';
import * as videos from './videos';
import * as viewerActivity from './viewer-activity';
import * as views from './views';
import * as watchHistory from './watch-history';
import * as webhooks from './webhooks';

export * from './admin-categories';
export * from './admin-dlq';
export * from './admin-videos';
export * from './analytics';
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
export * from './creator-videos';
export * from './endpoint';
export * from './events';
export * from './feed';
export * from './health';
export * from './live';
export * from './live-chat';
export * from './live-companion';
export * from './live-ingest';
export * from './me';
export * from './notifications';
export * from './oembed';
export * from './pagination';
export * from './picks';
export * from './playback';
export * from './playlists';
export * from './preferences';
export * from './problem';
export * from './problem-for';
export * from './reactions';
export * from './recommendation-feedback';
export * from './recommendations';
export * from './search';
export * from './saved-replies';
export * from './search-history';
export * from './shorts';
export * from './subscriptions';
export * from './telemetry';
export * from './trusted-commenters';
export * from './uploads';
export * from './video-resource';
export * from './videos';
export * from './viewer-activity';
export * from './views';
export * from './watch-history';
export * from './webhooks';

export const contracts = {
  adminCategories,
  adminDlq,
  adminVideos,
  analytics,
  bootstrap,
  captions,
  categories,
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
  creatorVideos,
  events,
  feed,
  health,
  live,
  liveChat,
  liveCompanion,
  liveIngest,
  me,
  notifications,
  oembed,
  picks,
  playback,
  playlists,
  preferences,
  reactions,
  recommendationFeedback,
  recommendations,
  search,
  searchHistory,
  shorts,
  subscriptions,
  telemetry,
  savedReplies,
  trustedCommenters,
  uploads,
  videos,
  viewerActivity,
  views,
  watchHistory,
  webhooks,
} as const;

export function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
