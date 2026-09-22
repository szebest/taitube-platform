import {
  type NewUploadInput,
  type UploadRecord,
  UploadRepository,
  type UploadWithVideo,
  type VideoRecord,
  type VideoRepository,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok, unwrapOr } from '@vp/result';

export interface InMemoryUploadRepositoryOptions {
  uploadsMap?: Map<string, UploadRecord>;
  videosMap?: Map<string, VideoRecord>;
  videosRepo?: VideoRepository;
}

export class InMemoryUploadRepository extends UploadRepository {
  private readonly uploadsMap: Map<string, UploadRecord>;
  private readonly videosMap?: Map<string, VideoRecord>;
  private videosRepo?: VideoRepository;

  constructor(
    optionsOrUploadsMap?: InMemoryUploadRepositoryOptions | Map<string, UploadRecord>,
    legacyVideosMap?: Map<string, VideoRecord>
  ) {
    super();
    if (optionsOrUploadsMap instanceof Map) {
      this.uploadsMap = optionsOrUploadsMap;
      this.videosMap = legacyVideosMap;
    } else {
      this.uploadsMap = optionsOrUploadsMap?.uploadsMap ?? new Map();
      this.videosMap = optionsOrUploadsMap?.videosMap;
      this.videosRepo = optionsOrUploadsMap?.videosRepo;
    }
  }

  setVideosRepo(repo: VideoRepository): void {
    this.videosRepo = repo;
  }

  async findById(id: string): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    return ok(this.uploadsMap.get(id) ?? null);
  }

  async findByVideoId(videoId: string): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    for (const upload of this.uploadsMap.values()) {
      if (upload.videoId === videoId) {
        return ok(upload);
      }
    }
    return ok(null);
  }

  async findWithVideo(
    uploadId: string
  ): Promise<Result<UploadWithVideo | null, DatabaseUnavailable>> {
    const upload = this.uploadsMap.get(uploadId);
    if (!upload) return ok(null);

    let video: VideoRecord | null = null;
    if (this.videosRepo) {
      video = unwrapOr(await this.videosRepo.findById(upload.videoId), null);
    } else if (this.videosMap) {
      video = this.videosMap.get(upload.videoId) ?? null;
    }

    if (!video) return ok(null);
    return ok({ upload, video });
  }

  async create(data: NewUploadInput): Promise<Result<UploadRecord, DatabaseUnavailable>> {
    const now = new Date();
    const record: UploadRecord = {
      id: data.id,
      videoId: data.videoId,
      strategy: data.strategy,
      status: data.status ?? 'OPEN',
      partSizeBytes: data.partSizeBytes ?? null,
      partsExpected: data.partsExpected ?? null,
      declaredSizeBytes: data.declaredSizeBytes,
      declaredContentType: data.declaredContentType,
      sha256: data.sha256 ?? null,
      multipartUploadId: data.multipartUploadId ?? null,
      expiresAt: data.expiresAt,
      completedAt: null,
      createdAt: now,
    };
    this.uploadsMap.set(record.id, record);
    return ok(record);
  }

  async updateStatus(
    uploadId: string,
    status: string
  ): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    const upload = this.uploadsMap.get(uploadId);
    if (!upload) return ok(null);
    upload.status = status as UploadRecord['status'];
    if (status === 'COMPLETED') {
      upload.completedAt = new Date();
    }
    return ok(upload);
  }

  clear(): void {
    this.uploadsMap.clear();
  }
}
