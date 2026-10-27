import {
  CommentItemActions,
  CommentItemAuthor,
  CommentItemFailed,
  CommentItemMenu,
  CommentItemPinned,
  CommentItemReactions,
  CommentItemReply,
  CommentItemRoot,
  CommentItemTimecode,
} from './comment-item';
import { CommentItemBody } from './comment-item-body';
import { CommentItemReplies } from './comment-item-replies';

export const CommentItem = {
  Root: CommentItemRoot,
  Pinned: CommentItemPinned,
  Author: CommentItemAuthor,
  Body: CommentItemBody,
  Timecode: CommentItemTimecode,
  Actions: CommentItemActions,
  Reactions: CommentItemReactions,
  Reply: CommentItemReply,
  Menu: CommentItemMenu,
  Failed: CommentItemFailed,
  Replies: CommentItemReplies,
};
export { useCommentItem } from './comment-item.context';
export { commentItemStyles } from './comment-item.variants';
export { CommentItemSkeleton } from './comment-item-skeleton';
