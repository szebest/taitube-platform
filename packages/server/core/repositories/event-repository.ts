import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface VideoEventRecord {
  id: number;
  videoId: string;
  type: string;
  payload: unknown;
  traceId?: string | null;
  createdAt: Date;
}

export interface NewVideoEventInput {
  videoId: string;
  type: string;
  payload?: Record<string, unknown>;
  traceId?: string | null;
}

export abstract class EventRepository {
  abstract create(data: NewVideoEventInput): Promise<Result<VideoEventRecord, DatabaseUnavailable>>;
  abstract findByVideoId(videoId: string): Promise<Result<VideoEventRecord[], DatabaseUnavailable>>;
  abstract findAfterId(
    videoId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>>;
  abstract findAfterIdForUser(
    userId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>>;
  abstract getLatestEventId(videoId: string): Promise<Result<number, DatabaseUnavailable>>;
}
