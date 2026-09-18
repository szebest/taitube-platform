export type Role = 'GUEST' | 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export type VideoAction =
  | 'video:read'
  | 'video:create'
  | 'video:update'
  | 'video:delete'
  | 'video:publish';

export type CommentAction = 'comment:create' | 'comment:delete' | 'comment:pin';

export type ChannelAction = 'channel:update' | 'channel:manage';

export type AdminAction = 'category:manage' | 'analytics:view_all';

export type Action = VideoAction | CommentAction | ChannelAction | AdminAction;

export interface UserContext {
  id: string;
  role?: Role | string;
  email?: string;
  [key: string]: unknown;
}

export interface VideoResource {
  ownerId?: string;
  visibility?: 'public' | 'unlisted' | 'private' | string;
  [key: string]: unknown;
}

export interface CommentResource {
  authorId?: string;
  videoId?: string;
  videoOwnerId?: string;
  [key: string]: unknown;
}

export interface ChannelResource {
  userId?: string;
  ownerId?: string;
  [key: string]: unknown;
}

export type Resource = VideoResource | CommentResource | ChannelResource | Record<string, unknown>;

export type PolicyRule<R = Resource> = (user: UserContext | null, resource?: R) => boolean;
