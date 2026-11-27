import {
  PostCardActions,
  PostCardBody,
  PostCardEdited,
  PostCardHeader,
  PostCardMedia,
  PostCardPinned,
  PostCardRoot,
  PostCardText,
} from './post-card';
import { PostCardShareCard } from './post-card-share-card';

export const PostCard = {
  Root: PostCardRoot,
  Header: PostCardHeader,
  Pinned: PostCardPinned,
  Edited: PostCardEdited,
  Body: PostCardBody,
  Text: PostCardText,
  Media: PostCardMedia,
  ShareCard: PostCardShareCard,
  Actions: PostCardActions,
};
export { usePostCard } from './post-card.context';
export type { PostShare } from './post-card-share-card';
