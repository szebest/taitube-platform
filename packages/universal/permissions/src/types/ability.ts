import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { AnalyticsResource } from './analytics';
import type { CategoryResource } from './category';
import type { ChannelResource } from './channel';
import type { CommentResource } from './comment';
import type { NotificationResource } from './notification';
import type { PlaylistResource } from './playlist';
import type { PreferencesResource } from './preferences';
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
      | (NotificationResource & ForcedSubject<'Notification'>)
    >
  | 'Video'
  | 'Upload'
  | 'Comment'
  | 'Channel'
  | 'Category'
  | 'Playlist'
  | 'Analytics'
  | 'Preferences'
  | 'Notification';

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;
