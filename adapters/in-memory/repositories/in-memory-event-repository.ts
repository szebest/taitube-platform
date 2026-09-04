import { EventRepository, type NewVideoEventInput, type VideoEventRecord } from '@vp/core/ports';

export class InMemoryEventRepository extends EventRepository {
  private readonly eventsList: VideoEventRecord[];

  constructor(eventsList: VideoEventRecord[] = []) {
    super();
    this.eventsList = eventsList;
  }

  async create(data: NewVideoEventInput): Promise<void> {
    this.eventsList.push({
      id: this.eventsList.length + 1,
      videoId: data.videoId,
      type: data.type,
      payload: data.payload,
      createdAt: new Date(),
    });
  }

  async findByVideoId(videoId: string): Promise<VideoEventRecord[]> {
    return this.eventsList.filter((e) => e.videoId === videoId);
  }

  clear(): void {
    this.eventsList.length = 0;
  }
}
