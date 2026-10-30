import type { ReactionType } from '@vp/domain';
import type { AvatarSize } from '@vp/ui';

export type CommentLevel = 'comment' | 'reply';
export type CommentState = 'view' | 'editing' | 'pending' | 'failed' | 'deleted' | 'removed';
export type CommentReaction = ReactionType | null;
export type CommentAvatarSize = Extract<AvatarSize, 'sm' | 'md' | 'lg'>;
