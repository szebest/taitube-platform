import { createCompoundContext } from '@vp/ui';
import type { CommentThreadLayout, CommentThreadSort } from './types';

export const [CommentThreadContext, useCommentThread] = createCompoundContext<{
  layout: CommentThreadLayout;
  sort: CommentThreadSort;
  setSort: (sort: CommentThreadSort) => void;
  headingId: string;
  endReached: (() => void) | undefined;
}>('CommentThread');
