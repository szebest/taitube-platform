import type { POST_KINDS, PostStatus } from './channel-post';
import type { ModerationState } from './comment-moderation';
import type { Disclosure } from './comment-settings';
import type { VideoStatus, VideoVisibility } from './status-vocabulary';
import type { ViewDate } from './views';

/** A daily row carries the day and its counts, a retention row the step and its viewers; the rest is null. */
export type VideoAnalyticsExportRow = {
  videoId: string;
  title: string;
  series: 'daily' | 'retention';
  day: ViewDate | null;
  views: number | null;
  watchSeconds: number | null;
  percent: number | null;
  viewers: number | null;
};

export type ChannelAnalyticsExportRow = {
  day: ViewDate;
  views: number;
  watchSeconds: number;
  subscribersGained: number;
  subscribersLost: number;
};

/** A commenter appears by their public identity only: never an email or an account id. */
export type CommentExportRow = {
  commentId: string;
  videoId: string;
  videoTitle: string;
  parentId: string | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  text: string;
  createdAt: string;
  likes: number;
  hearted: boolean;
  pinned: boolean;
  moderationState: ModerationState;
  disclosure: Disclosure | null;
};

export type VideoExportRow = {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  category: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  durationMs: number | null;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  createdAt: string;
  readyAt: string | null;
};

/** `payload` is the post's own JSON, so a CSV cell holds it whole whatever the kind. */
export type PostExportRow = {
  postId: string;
  kind: (typeof POST_KINDS)[number];
  status: PostStatus;
  payload: string;
  commentsEnabled: boolean;
  likeCount: number;
  commentsCount: number;
  publishedAt: string | null;
  createdAt: string;
  editedAt: string | null;
};

/** One keyset page; `next` is the opaque position after its last row, `null` on the last page. */
export interface ExportRowPage<Row> {
  rows: Row[];
  next: string | null;
}
