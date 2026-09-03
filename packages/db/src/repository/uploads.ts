import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { type NewUpload, type Upload, type Video, uploads, videos } from '../schema.js';

export interface UploadWithVideo {
  upload: Upload;
  video: Video;
}

export async function createUpload(db: Database, uploadData: NewUpload): Promise<Upload> {
  const [created] = await db.insert(uploads).values(uploadData).returning();
  if (!created) {
    throw new Error('Failed to create upload record');
  }
  return created;
}

export async function getUploadById(db: Database, uploadId: string): Promise<Upload | null> {
  const rows = await db.select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);
  return rows[0] || null;
}

export async function getUploadWithVideo(
  db: Database,
  uploadId: string
): Promise<UploadWithVideo | null> {
  const rows = await db
    .select({
      upload: uploads,
      video: videos,
    })
    .from(uploads)
    .innerJoin(videos, eq(uploads.videoId, videos.id))
    .where(eq(uploads.id, uploadId))
    .limit(1);

  return rows[0] || null;
}

export async function updateUploadStatus(
  db: Database,
  uploadId: string,
  status: Upload['status']
): Promise<Upload | null> {
  const [updated] = await db
    .update(uploads)
    .set({ status })
    .where(eq(uploads.id, uploadId))
    .returning();
  return updated || null;
}
