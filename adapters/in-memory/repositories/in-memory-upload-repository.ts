import {
  type NewUploadInput,
  type UploadRecord,
  UploadRepository,
  type UploadWithVideo,
  type VideoRecord,
} from '@vp/core/ports';

export class InMemoryUploadRepository extends UploadRepository {
  constructor(
    private readonly uploadsMap: Map<string, UploadRecord>,
    private readonly videosMap: Map<string, VideoRecord>
  ) {
    super();
  }

  async findById(id: string): Promise<UploadRecord | null> {
    return this.uploadsMap.get(id) ?? null;
  }

  async findWithVideo(uploadId: string): Promise<UploadWithVideo | null> {
    const upload = this.uploadsMap.get(uploadId);
    if (!upload) return null;
    const video = this.videosMap.get(upload.videoId);
    if (!video) return null;
    return { upload, video };
  }

  async create(data: NewUploadInput): Promise<UploadRecord> {
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
    return record;
  }

  async updateStatus(uploadId: string, status: string): Promise<UploadRecord | null> {
    const upload = this.uploadsMap.get(uploadId);
    if (!upload) return null;
    upload.status = status as UploadRecord['status'];
    if (status === 'COMPLETED') {
      upload.completedAt = new Date();
    }
    return upload;
  }
}
