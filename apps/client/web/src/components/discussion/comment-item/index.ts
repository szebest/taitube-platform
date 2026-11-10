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
import { CommentItemBody } from './components/comment-item-body/comment-item-body';
import { CommentItemHeart } from './components/comment-item-heart/comment-item-heart';
import { CommentItemModeration } from './components/comment-item-moderation/comment-item-moderation';
import { CommentItemReplies } from './components/comment-item-replies/comment-item-replies';

export const CommentItem = {
  Root: CommentItemRoot,
  Pinned: CommentItemPinned,
  Author: CommentItemAuthor,
  Body: CommentItemBody,
  Timecode: CommentItemTimecode,
  Actions: CommentItemActions,
  Reactions: CommentItemReactions,
  Heart: CommentItemHeart,
  Reply: CommentItemReply,
  Menu: CommentItemMenu,
  Failed: CommentItemFailed,
  Moderation: CommentItemModeration,
  Replies: CommentItemReplies,
};
export { useCommentItem } from './comment-item.context';
export { commentItemStyles } from './comment-item.variants';
export { CommentItemSkeleton } from './components/comment-item-skeleton/comment-item-skeleton';
