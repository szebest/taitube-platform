import type { AdminAction, CategoryResource } from './category.js';
import type { ChannelAction, ChannelResource } from './channel.js';
import type { CommentAction, CommentResource } from './comment.js';
import type { UploadResource } from './upload.js';
import type { VideoAction, VideoResource } from './video.js';

export * from './user.js';
export * from './video.js';
export * from './comment.js';
export * from './channel.js';
export * from './upload.js';
export * from './category.js';
export * from './ability.js';

export type Resource =
  | VideoResource
  | UploadResource
  | CommentResource
  | ChannelResource
  | CategoryResource;

export type Action = VideoAction | CommentAction | ChannelAction | AdminAction;
