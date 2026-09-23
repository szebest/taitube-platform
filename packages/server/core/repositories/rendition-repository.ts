import type { RenditionStatus } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface RenditionRecord {
  id: string;
  videoId: string;
  name: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  status: RenditionStatus;
  playlistKey?: string | null;
  segmentCount?: number | null;
  bytes?: number | null;
  processingMs?: number | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NewRenditionInput {
  id?: string;
  videoId: string;
  name: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  status?: RenditionStatus;
  playlistKey?: string | null;
  segmentCount?: number | null;
  bytes?: number | null;
}

export abstract class RenditionRepository {
  abstract create(data: NewRenditionInput): Promise<Result<RenditionRecord, DatabaseUnavailable>>;
  abstract findByVideoId(videoId: string): Promise<Result<RenditionRecord[], DatabaseUnavailable>>;
  abstract findByVideoIds(
    videoIds: string[]
  ): Promise<Result<RenditionRecord[], DatabaseUnavailable>>;
  abstract update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<Result<RenditionRecord | null, DatabaseUnavailable>>;
}
