import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { CategoryResource } from './category.js';
import type { ChannelResource } from './channel.js';
import type { CommentResource } from './comment.js';
import type { UploadResource } from './upload.js';
import type { VideoResource } from './video.js';

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
