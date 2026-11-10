import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { AnalyticsResource } from './analytics';
import type { CaptionResource } from './caption';
import type { CategoryResource } from './category';
import type { ChannelResource } from './channel';
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
import type { PreferencesResource } from './preferences';
import type { RecommendationFeedbackResource } from './recommendation-feedback';
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
  | 'queue'
  | 'access'
  | 'hold'
  | 'approve'
  | 'hide'
  | 'unhide'
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
      | (PlaylistResource & ForcedSubject<'Playlist'>)
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
    >
  | 'Video'
  | 'Upload'
  | 'Comment'
  | 'Channel'
  | 'Category'
  | 'Playlist'
  | 'Queue'
  | 'Analytics'
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
  | 'CommentSettings';

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;
