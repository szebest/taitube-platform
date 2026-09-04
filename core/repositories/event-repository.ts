export interface VideoEventRecord {
  id: number;
  videoId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}

export interface NewVideoEventInput {
  videoId: string;
  type: string;
  payload?: Record<string, unknown>;
}

export abstract class EventRepository {
  abstract create(data: NewVideoEventInput): Promise<VideoEventRecord>;
  abstract findByVideoId(videoId: string): Promise<VideoEventRecord[]>;
  abstract findAfterId(videoId: string, afterId: number): Promise<VideoEventRecord[]>;
  abstract findAfterIdForUser(userId: string, afterId: number): Promise<VideoEventRecord[]>;
  abstract getLatestEventId(videoId: string): Promise<number>;
}
