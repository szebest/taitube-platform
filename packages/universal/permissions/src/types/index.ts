import type { AdminAction, CategoryResource } from './category';
import type { ChannelAction, ChannelResource } from './channel';
import type { CommentAction, CommentResource } from './comment';
import type { UploadResource } from './upload';
import type { VideoAction, VideoResource } from './video';

export * from './user';
export * from './video';
export * from './comment';
export * from './channel';
export * from './upload';
export * from './category';
export * from './ability';

export type Resource =
  | VideoResource
  | UploadResource
  | CommentResource
  | ChannelResource
  | CategoryResource;

export type Action = VideoAction | CommentAction | ChannelAction | AdminAction;
