import { type NewRenditionInput, type RenditionRecord, RenditionRepository } from '@vp/core/ports';

export class InMemoryRenditionRepository extends RenditionRepository {
  constructor(private readonly renditionsMap: Map<string, RenditionRecord>) {
    super();
  }

  async create(data: NewRenditionInput): Promise<RenditionRecord> {
    const now = new Date();
    const id = data.id ?? `rend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: RenditionRecord = {
      id,
      videoId: data.videoId,
      name: data.name,
      width: data.width,
      height: data.height,
      videoBitrateKbps: data.videoBitrateKbps,
      audioBitrateKbps: data.audioBitrateKbps,
      status: data.status ?? 'PENDING',
      playlistKey: data.playlistKey ?? null,
      playlistUrl: data.playlistUrl ?? null,
      segmentCount: data.segmentCount ?? null,
      bytes: data.bytes ?? null,
      durationMs: data.durationMs ?? null,
      processingMs: null,
      createdAt: now,
    };
    this.renditionsMap.set(id, record);
    return record;
  }

  async findByVideoId(videoId: string): Promise<RenditionRecord[]> {
    const results: RenditionRecord[] = [];
    for (const r of this.renditionsMap.values()) {
      if (r.videoId === videoId) {
        results.push(r);
      }
    }
    return results;
  }

  async update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<RenditionRecord | null> {
    const rendition = Array.from(this.renditionsMap.values()).find(
      (r) => r.videoId === videoId && r.name === name
    );
    if (!rendition) return null;
    Object.assign(rendition, patch);
    return { ...rendition };
  }
}
