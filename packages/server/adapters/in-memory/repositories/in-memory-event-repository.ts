import {
  EventRepository,
  type NewVideoEventInput,
  type VideoEventRecord,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok, unwrapOr } from '@vp/result';

/** The one thing this repository needs from a video: who owns it. */
export interface VideoOwnerLookup {
  findById(id: string): Promise<Result<{ ownerId: string } | null, unknown>>;
}

export class InMemoryEventRepository extends EventRepository {
  private readonly eventsList: VideoEventRecord[];
  private readonly videosRepo?: VideoOwnerLookup;

  constructor(eventsList: VideoEventRecord[] = [], videosRepo?: VideoOwnerLookup) {
    super();
    this.eventsList = eventsList;
    this.videosRepo = videosRepo;
  }

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

  async findAfterIdForUser(
    userId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    if (!this.videosRepo) {
      return ok(this.eventsList.filter((e) => e.id > afterId).sort((a, b) => a.id - b.id));
    }
    const matching: VideoEventRecord[] = [];
    for (const event of this.eventsList) {
      if (event.id > afterId) {
        const video = unwrapOr(await this.videosRepo.findById(event.videoId), null);
        if (video && video.ownerId === userId) {
          matching.push(event);
        }
      }
    }
    return ok(matching.sort((a, b) => a.id - b.id));
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
