import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { CategoryResource } from './category';
import type { ChannelResource } from './channel';
import type { CommentResource } from './comment';
import type { UploadResource } from './upload';
import type { VideoResource } from './video';

export type AppAction =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'react'
  | 'pin'
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
    >
  | 'Video'
  | 'Upload'
  | 'Comment'
  | 'Channel'
  | 'Category'
  | 'Analytics';

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;
