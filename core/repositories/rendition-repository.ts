export type RenditionStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';

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
  playlistUrl?: string | null;
  segmentCount?: number | null;
  bytes?: number | null;
  durationMs?: number | null;
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
  playlistUrl?: string | null;
  segmentCount?: number | null;
  bytes?: number | null;
  durationMs?: number | null;
}

export abstract class RenditionRepository {
  abstract create(data: NewRenditionInput): Promise<RenditionRecord>;
  abstract findByVideoId(videoId: string): Promise<RenditionRecord[]>;
  abstract findByVideoIds(videoIds: string[]): Promise<RenditionRecord[]>;
  abstract update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<RenditionRecord | null>;
}
