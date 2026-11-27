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

/** `POST_LIFECYCLE` in `@vp/domain-rules` is the machine over these edges. */
export const POST_LIFECYCLE_EDGES = {
  schedule: { from: ['draft'], to: 'scheduled' },
  publish: { from: ['draft', 'scheduled'], to: 'published' },
} as const satisfies Record<string, { from: readonly PostStatus[]; to: PostStatus }>;

export const POSTS_PER_DAY = 20;
export const POSTS_PENDING_LIMIT = 50;
export const POSTS_PINNED_LIMIT = 3;
export const POLL_OPTIONS = { min: 2, max: 6 } as const;
export const POLL_MAX_OPEN_DAYS = 30;

interface PostImage {
  /** A ready `post-image` upload of the post's channel. */
  uploadId: string;
  alt: string;
}

export type PostPayload =
  | { kind: 'text'; text: string }
  | { kind: 'images'; images: PostImage[]; caption: string | null }
  | { kind: 'poll'; question: string; options: string[]; closesAt: string | null }
  | {
      kind: 'quiz';
      question: string;
      options: string[];
      closesAt: string | null;
      correctIndex: number;
      explanation: string | null;
    }
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

export interface NewUnpublishedPostInput extends NewChannelPostInput {
  status: 'draft' | 'scheduled';
  publishAt: Date | null;
}

/** A published post as the team sees it in the studio list, with its place in the pipeline. */
export interface ManagedPostCursor {
  createdAt: Date;
  id: string;
}

export type PostPinOutcome = 'pinned' | 'unpinned' | 'limit' | 'missing' | 'not_published';

export interface PostStats {
  opens: number;
  shareClicks: number;
  likes: number;
  replies: number;
  votesByOption: number[];
  quizCorrectShare: number | null;
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
