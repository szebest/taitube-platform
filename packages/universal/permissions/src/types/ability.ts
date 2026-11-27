import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { AnalyticsResource, VideoStatsResource } from './analytics';
import type { ApiTokenResource } from './api-token';
import type { CaptionResource } from './caption';
import type { CategoryResource } from './category';
import type { ChannelResource } from './channel';
import type { ChannelExportResource } from './channel-export';
import type {
  ChannelAuditResource,
  ChannelInviteResource,
  ChannelMemberResource,
} from './channel-team';
import type { ClipResource } from './clip';
import type { CommentResource } from './comment';
import type { ChannelUserResource, CommentSettingsResource } from './comment-moderation';
import type { LiveStreamResource } from './live-stream';
import type { NotificationResource } from './notification';
import type { PlaylistResource } from './playlist';
import type { PostResource } from './post';
import type { PreferencesResource } from './preferences';
import type { RecommendationFeedbackResource } from './recommendation-feedback';
import type { ThreadResource } from './thread';
import type { UploadResource } from './upload';
import type { VideoResource } from './video';
import type { WatchPartyResource } from './watch-party';

export type AppAction =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'moderate'
  | 'appeal'
  | 'react'
  | 'pin'
  | 'heart'
  | 'report'
  | 'subscribe'
  | 'act'
  | 'own'
  | 'queue'
  | 'access'
  | 'hold'
  | 'approve'
  | 'hide'
  | 'unhide'
  | 'close'
  | 'restore'
  | 'remove'
  | 'restrict';

export type AppSubjects =
  | 'all'
  | InferSubjects<
      | (VideoResource & ForcedSubject<'Video'>)
      | (UploadResource & ForcedSubject<'Upload'>)
      | (CommentResource & ForcedSubject<'Comment'>)
      | (ChannelResource & ForcedSubject<'Channel'>)
      | (CategoryResource & ForcedSubject<'Category'>)
      | (AnalyticsResource & ForcedSubject<'Analytics'>)
      | (VideoStatsResource & ForcedSubject<'VideoStats'>)
      | (PlaylistResource & ForcedSubject<'Playlist'>)
      | (PostResource & ForcedSubject<'Post'>)
      | (PostResource & ForcedSubject<'PostStats'>)
      | (ThreadResource & ForcedSubject<'Thread'>)
      | (PreferencesResource & ForcedSubject<'Preferences'>)
      | (CaptionResource & ForcedSubject<'Caption'>)
      | (NotificationResource & ForcedSubject<'Notification'>)
      | (ClipResource & ForcedSubject<'Clip'>)
      | (LiveStreamResource & ForcedSubject<'LiveStream'>)
      | (RecommendationFeedbackResource & ForcedSubject<'RecommendationFeedback'>)
      | (WatchPartyResource & ForcedSubject<'WatchParty'>)
      | (ChannelMemberResource & ForcedSubject<'ChannelMember'>)
      | (ChannelInviteResource & ForcedSubject<'ChannelInvite'>)
      | (ChannelAuditResource & ForcedSubject<'ChannelAudit'>)
      | (ChannelUserResource & ForcedSubject<'ChannelUser'>)
      | (CommentSettingsResource & ForcedSubject<'CommentSettings'>)
      | (ChannelExportResource & ForcedSubject<'ChannelExport'>)
      | (ApiTokenResource & ForcedSubject<'ApiToken'>)
    >
  | 'Video'
  | 'Upload'
  | 'Comment'
  | 'Channel'
  | 'Category'
  | 'Playlist'
  | 'Post'
  | 'PostStats'
  | 'Thread'
  | 'Queue'
  | 'Analytics'
  | 'VideoStats'
  | 'Preferences'
  | 'Caption'
  | 'Notification'
  | 'Clip'
  | 'LiveStream'
  | 'Pick'
  | 'RecommendationFeedback'
  | 'Webhook'
  | 'WatchParty'
  | 'ChannelMember'
  | 'ChannelInvite'
  | 'ChannelAudit'
  | 'ChannelUser'
  | 'CommentSettings'
  | 'ChannelExport'
  | 'ApiToken';

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;
