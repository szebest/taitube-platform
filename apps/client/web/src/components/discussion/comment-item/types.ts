import type { AvatarSize } from '@kit/ui';
import type { ReactionType } from '@vp/domain';

export type CommentLevel = 'comment' | 'reply';
export type CommentState =
  | 'view'
  | 'editing'
  | 'pending'
  | 'failed'
  | 'deleted'
  | 'removed'
  | 'held'
  | 'hidden';
export type CommentReaction = ReactionType | null;
export type CommentAvatarSize = Extract<AvatarSize, 'sm' | 'md' | 'lg'>;
