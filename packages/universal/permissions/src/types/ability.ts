import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { AnalyticsResource } from './analytics';
import type { CaptionResource } from './caption';
import type { CategoryResource } from './category';
import type { ChannelResource } from './channel';
import type { ClipResource } from './clip';
import type { CommentResource } from './comment';
import type { NotificationResource } from './notification';
import type { PlaylistResource } from './playlist';
import type { PreferencesResource } from './preferences';
import type { RecommendationFeedbackResource } from './recommendation-feedback';
import type { UploadResource } from './upload';
import type { VideoResource } from './video';

export type AppAction =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'moderate'
  | 'react'
  | 'pin'
  | 'heart'
  | 'report'
  | 'subscribe'
  | 'access';

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
      | (RecommendationFeedbackResource & ForcedSubject<'RecommendationFeedback'>)
    >
  | 'Video'
  | 'Upload'
  | 'Comment'
  | 'Channel'
  | 'Category'
  | 'Playlist'
  | 'Analytics'
  | 'Preferences'
  | 'Caption'
  | 'Notification'
  | 'Clip'
  | 'RecommendationFeedback';

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;
