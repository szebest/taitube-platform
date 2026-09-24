import {
  type NewRenditionInput,
  type RenditionRecord,
  RenditionRepository,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export class InMemoryRenditionRepository extends RenditionRepository {
  private readonly renditionsMap = new Map<string, RenditionRecord>();

  async create(data: NewRenditionInput): Promise<Result<RenditionRecord, DatabaseUnavailable>> {
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
      segmentCount: data.segmentCount ?? null,
      bytes: data.bytes ?? null,
      processingMs: null,
      createdAt: now,
    };
    this.renditionsMap.set(id, record);
    return ok(record);
  }

  async findByVideoId(videoId: string): Promise<Result<RenditionRecord[], DatabaseUnavailable>> {
    const results: RenditionRecord[] = [];
    for (const r of this.renditionsMap.values()) {
      if (r.videoId === videoId) {
        results.push(r);
      }
    }
    return ok(results);
  }

  async findByVideoIds(
    videoIds: string[]
  ): Promise<Result<RenditionRecord[], DatabaseUnavailable>> {
    const idSet = new Set(videoIds);
    const results: RenditionRecord[] = [];
    for (const r of this.renditionsMap.values()) {
      if (idSet.has(r.videoId)) {
        results.push(r);
      }
    }
    return ok(results);
  }

  async update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<Result<RenditionRecord | null, DatabaseUnavailable>> {
    const rendition = Array.from(this.renditionsMap.values()).find(
      (r) => r.videoId === videoId && r.name === name
    );
    if (!rendition) return ok(null);
    Object.assign(rendition, patch);
    return ok({ ...rendition });
  }

  clear(): void {
    this.renditionsMap.clear();
  }
}
