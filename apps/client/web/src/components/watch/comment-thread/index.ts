import {
  CommentThreadComposer,
  CommentThreadHeader,
  CommentThreadItem,
  CommentThreadList,
  CommentThreadMore,
  CommentThreadRoot,
} from './comment-thread';

export const CommentThread = {
  Root: CommentThreadRoot,
  Header: CommentThreadHeader,
  Composer: CommentThreadComposer,
  List: CommentThreadList,
  Item: CommentThreadItem,
  More: CommentThreadMore,
};

export { CommentThreadSkeleton } from './comment-thread';

export { useCommentThread } from './comment-thread.context';
export { commentThreadStyles } from './comment-thread.variants';
export type { CommentThreadLayout } from './types';
