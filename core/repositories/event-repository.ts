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
  abstract create(data: NewVideoEventInput): Promise<void>;
  abstract findByVideoId(videoId: string): Promise<VideoEventRecord[]>;
}
