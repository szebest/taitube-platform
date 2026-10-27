import * as adminCategories from './admin-categories';
import * as adminDlq from './admin-dlq';
import * as adminVideos from './admin-videos';
import * as analytics from './analytics';
import * as bootstrap from './bootstrap';
import * as captions from './captions';
import * as categories from './categories';
import * as channelPlaylists from './channel-playlists';
import * as channelVideos from './channel-videos';
import * as channels from './channels';
import * as commentReports from './comment-reports';
import * as comments from './comments';
import * as creatorComments from './creator-comments';
import * as creatorVideos from './creator-videos';
import * as events from './events';
import * as feed from './feed';
import * as health from './health';
import * as me from './me';
import * as playback from './playback';
import * as playlists from './playlists';
import * as preferences from './preferences';
import * as reactions from './reactions';
import * as recommendations from './recommendations';
import * as search from './search';
import * as subscriptions from './subscriptions';
import * as telemetry from './telemetry';
import * as uploads from './uploads';
import * as videos from './videos';
import * as views from './views';
import * as watchHistory from './watch-history';

export * from './admin-categories';
export * from './admin-dlq';
export * from './admin-videos';
export * from './analytics';
export * from './bootstrap';
export * from './captions';
export * from './categories';
export * from './channel-playlists';
export * from './channel-videos';
export * from './channels';
export * from './comment-reports';
export * from './comments';
export * from './creator-comments';
export * from './creator-videos';
export * from './endpoint';
export * from './events';
export * from './feed';
export * from './health';
export * from './me';
export * from './pagination';
export * from './playback';
export * from './playlists';
export * from './preferences';
export * from './problem';
export * from './problem-for';
export * from './reactions';
export * from './recommendations';
export * from './search';
export * from './subscriptions';
export * from './telemetry';
export * from './uploads';
export * from './video-resource';
export * from './videos';
export * from './views';
export * from './watch-history';

export const contracts = {
  adminCategories,
  adminDlq,
  adminVideos,
  analytics,
  bootstrap,
  captions,
  categories,
  channelPlaylists,
  channelVideos,
  channels,
  commentReports,
  comments,
  creatorComments,
  creatorVideos,
  events,
  feed,
  health,
  me,
  playback,
  playlists,
  preferences,
  reactions,
  recommendations,
  search,
  subscriptions,
  telemetry,
  uploads,
  videos,
  views,
  watchHistory,
} as const;

export function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
