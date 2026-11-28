import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { RenditionStatus } from '@vp/domain';

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
