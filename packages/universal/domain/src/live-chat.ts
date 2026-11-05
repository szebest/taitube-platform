interface LiveChatAuthor {
  userId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** One chat line; ids are UUIDv7, so a stream's messages sort by id in the order they were sent. */
export interface LiveChatMessage {
  id: string;
  liveStreamId: string;
  author: LiveChatAuthor;
  message: string;
  /** Milliseconds from the broadcast's `startedAt`: where the line sits on the recording. */
  offsetMs: number;
  createdAt: Date;
}

export interface NewLiveChatMessage {
  id: string;
  liveStreamId: string;
  userId: string;
  message: string;
  offsetMs: number;
  createdAt: Date;
}

/** A clock that runs a little behind the database's `started_at` still files the line at zero. */
export function liveChatOffsetMs(startedAt: Date, at: Date): number {
  return Math.max(0, at.getTime() - startedAt.getTime());
}
