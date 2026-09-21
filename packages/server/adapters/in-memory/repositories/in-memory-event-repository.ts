import { EventRepository, type NewVideoEventInput, type VideoEventRecord } from '@vp/core/ports';

export class InMemoryEventRepository extends EventRepository {
  private readonly eventsList: VideoEventRecord[];
  private videosRepo?: { findById(id: string): Promise<{ ownerId: string } | null> };

  constructor(
    eventsList: VideoEventRecord[] = [],
    videosRepo?: { findById(id: string): Promise<{ ownerId: string } | null> }
  ) {
    super();
    this.eventsList = eventsList;
    this.videosRepo = videosRepo;
  }

  setVideosRepo(repo: { findById(id: string): Promise<{ ownerId: string } | null> }): void {
    this.videosRepo = repo;
  }

  async create(data: NewVideoEventInput): Promise<VideoEventRecord> {
    const record: VideoEventRecord = {
      id: this.eventsList.length + 1,
      videoId: data.videoId,
      type: data.type,
      payload: data.payload,
      traceId: data.traceId ?? null,
      createdAt: new Date(),
    };
    this.eventsList.push(record);
    return record;
  }

  async findByVideoId(videoId: string): Promise<VideoEventRecord[]> {
    return this.eventsList.filter((e) => e.videoId === videoId);
  }

  async findAfterId(videoId: string, afterId: number): Promise<VideoEventRecord[]> {
    return this.eventsList
      .filter((e) => e.videoId === videoId && e.id > afterId)
      .sort((a, b) => a.id - b.id);
  }

  async findAfterIdForUser(userId: string, afterId: number): Promise<VideoEventRecord[]> {
    if (!this.videosRepo) {
      return this.eventsList.filter((e) => e.id > afterId).sort((a, b) => a.id - b.id);
    }
    const matching: VideoEventRecord[] = [];
    for (const event of this.eventsList) {
      if (event.id > afterId) {
        const video = await this.videosRepo.findById(event.videoId);
        if (video && video.ownerId === userId) {
          matching.push(event);
        }
      }
    }
    return matching.sort((a, b) => a.id - b.id);
  }

  async getLatestEventId(videoId: string): Promise<number> {
    const events = this.eventsList.filter((e) => e.videoId === videoId);
    if (events.length === 0) return 0;
    return Math.max(...events.map((e) => e.id));
  }

  clear(): void {
    this.eventsList.length = 0;
  }
}
