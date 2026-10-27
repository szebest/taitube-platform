import { createCompoundContext } from '@vp/ui';
import type { CommentLevel, CommentState } from './types';

export const [CommentItemContext, useCommentItem] = createCompoundContext<{
  level: CommentLevel;
  state: CommentState;
  authorId: string;
  timeId: string;
}>('CommentItem');
