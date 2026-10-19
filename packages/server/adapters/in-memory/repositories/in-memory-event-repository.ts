import {
  EventRepository,
  type NewVideoEventInput,
  type VideoEventRecord,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export class InMemoryEventRepository extends EventRepository {
  private readonly eventsList: VideoEventRecord[] = [];

  async create(data: NewVideoEventInput): Promise<Result<VideoEventRecord, DatabaseUnavailable>> {
    const record: VideoEventRecord = {
      id: this.eventsList.length + 1,
      videoId: data.videoId,
      type: data.type,
      payload: data.payload,
      traceId: data.traceId ?? null,
      createdAt: new Date(),
    };
    this.eventsList.push(record);
    return ok(record);
  }

  async findByVideoId(videoId: string): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    return ok(this.eventsList.filter((e) => e.videoId === videoId));
  }

  async findAfterId(
    videoId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    return ok(
      this.eventsList
        .filter((e) => e.videoId === videoId && e.id > afterId)
        .sort((a, b) => a.id - b.id)
    );
  }

  async getLatestEventId(videoId: string): Promise<Result<number, DatabaseUnavailable>> {
    const events = this.eventsList.filter((e) => e.videoId === videoId);
    if (events.length === 0) return ok(0);
    return ok(Math.max(...events.map((e) => e.id)));
  }

  clear(): void {
    this.eventsList.length = 0;
  }
}
