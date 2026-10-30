import type { ChannelCard } from './channel';
import type { Video } from './video';

export interface LikedVideoEntry {
  id: string;
  likedAt: Date;
  video: Video;
  channel: ChannelCard | null;
}

export interface AuthoredComment {
  id: string;
  content: string;
  createdAt: Date;
  parentId: string | null;
  likeCount: number;
  video: { id: string; title: string };
}
