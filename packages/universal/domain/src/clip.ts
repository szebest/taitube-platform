import type { ChannelCard } from './channel';
import type { Video } from './video';

export const CLIP_MIN_MS = 5_000;
export const CLIP_MAX_MS = 60_000;

export interface Clip {
  id: string;
  videoId: string;
  userId: string;
  startMs: number;
  endMs: number;
  title: string;
  createdAt: Date;
}

export interface ClipEntry {
  clip: Clip;
  video: Video;
  channel: ChannelCard | null;
}
