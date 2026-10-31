import type { ChannelCard } from './channel';
import type { Video } from './video';

export interface EditorPick {
  id: string;
  videoId: string;
  startsAt: Date;
  endsAt: Date;
  note: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface EditorPickEntry {
  pick: EditorPick;
  video: Video;
  channel: ChannelCard | null;
}
