export const POST_KINDS = [
  'text',
  'images',
  'poll',
  'quiz',
  'video_share',
  'playlist_share',
] as const;

export const POST_STATUSES = ['draft', 'scheduled', 'published'] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_TEXT_MAX = 2000;
export const POST_IMAGES_MAX = 4;
export const POST_IMAGE_ALT_MAX = 200;
export const POST_SHARE_COMMENT_MAX = 500;
export const POSTS_PER_DAY = 20;

export interface PostImage {
  /** A ready `post-image` upload of the post's channel. */
  uploadId: string;
  alt: string;
}

export type PostPayload =
  | { kind: 'text'; text: string }
  | { kind: 'images'; images: PostImage[]; caption: string | null }
  | { kind: 'video_share'; videoId: string; comment: string | null; startMs: number | null }
  | { kind: 'playlist_share'; playlistId: string; comment: string | null };

export type PostKind = PostPayload['kind'];

export interface ChannelPost {
  id: string;
  channelId: string;
  authorUserId: string;
  payload: PostPayload;
  status: PostStatus;
  publishAt: Date | null;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  commentsEnabled: boolean;
  editedAt: Date | null;
  likeCount: number;
  commentsCount: number;
  version: number;
  createdAt: Date;
}

export interface NewChannelPostInput {
  id: string;
  channelId: string;
  authorUserId: string;
  payload: PostPayload;
  commentsEnabled: boolean;
}

/** What a shared video or playlist shows on the card, or `unavailable` once it is not public. */
export type PostShareCard =
  | {
      type: 'video';
      id: string;
      title: string;
      thumbnailUrl: string | null;
      durationSeconds: number | null;
    }
  | { type: 'playlist'; id: string; title: string; itemCount: number }
  | { type: 'unavailable' };

/** A published post with what the viewer did to it. */
export interface ChannelPostEntry {
  post: ChannelPost;
  likedByViewer: boolean;
}

/** Keyset position of a channel's posts: pinned first, then newest. */
export interface ChannelPostCursor {
  pinnedAt: Date | null;
  publishedAt: Date;
  id: string;
}
