import type { UserRole, UserTier, VideoVisibility } from '@vp/domain';

export const CLIP_SOURCES = [
  'testsrc2',
  'gradients',
  'life',
  'mandelbrot',
  'cellauto',
  'smptebars',
  'rgbtestsrc',
] as const;

type ClipSource = (typeof CLIP_SOURCES)[number];

export type UserKind = 'viewer' | 'creator' | 'admin' | 'moderator' | 'extra-creator' | 'fan';

export interface UserSpec {
  id: string;
  kind: UserKind;
  email: string;
  tier: UserTier;
  role: UserRole;
  /** The `role` claim of the dev token this user signs in with. */
  tokenRole: string;
  handle: string;
  displayName: string;
  /** Owns a channel with videos, a banner and a bio; every other user only gets a name. */
  ownsChannel: boolean;
  bio: string | null;
  brandColor: string;
  hue: number;
}

interface CategorySpec {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface VideoSpec {
  key: string;
  ownerId: string;
  title: string;
  description: string;
  categorySlug: string;
  tags: readonly string[];
  visibility: VideoVisibility;
  shape: 'standard' | 'short';
  seconds: number;
  source: ClipSource;
  hue: number;
  toneHz: number;
}

export interface CommentSpec {
  videoKey: string;
  authorId: string;
  text: string;
  pinned: boolean;
  hearted: boolean;
  replies: readonly { authorId: string; text: string }[];
}

export interface ReactionSpec {
  videoKey: string;
  userId: string;
  type: 'LIKE' | 'DISLIKE';
}

export interface SubscriptionSpec {
  subscriberId: string;
  channelOwnerId: string;
}

export interface PlaylistSpec {
  ownerId: string;
  title: string;
  description: string;
  visibility: 'public' | 'unlisted' | 'private';
  videoKeys: readonly string[];
}

export interface HistorySpec {
  userId: string;
  videoKey: string;
  fraction: number;
}

export interface SearchSpec {
  userId: string;
  query: string;
}

export interface ReportSpec {
  reporterId: string;
  videoKey: string;
  commentText: string;
  commentAuthorId: string;
  reason: 'spam' | 'harassment' | 'hate' | 'misinformation' | 'other';
  note: string;
}

export interface FeaturedSpec {
  ownerId: string;
  videoKeys: readonly string[];
  trailerVideoKey: string | null;
}

export interface WorldSpec {
  seed: number;
  categories: readonly CategorySpec[];
  users: readonly UserSpec[];
  videos: readonly VideoSpec[];
  comments: readonly CommentSpec[];
  reactions: readonly ReactionSpec[];
  subscriptions: readonly SubscriptionSpec[];
  playlists: readonly PlaylistSpec[];
  history: readonly HistorySpec[];
  searches: readonly SearchSpec[];
  reports: readonly ReportSpec[];
  featured: readonly FeaturedSpec[];
}
