import axios from 'axios';
import type { ApiClient } from '@vp/api-client';
import { uploadVideo } from '../upload-video';

vi.mock('axios', () => ({
  default: { put: vi.fn(async () => ({ headers: { etag: '"part-etag"' } })) },
}));

const put = axios.put as unknown as ReturnType<typeof vi.fn>;

const VIDEO_ID = '00000000-0000-7000-8000-000000000001';
const UPLOAD_ID = '00000000-0000-7000-8000-0000000000u1';

const file = { name: 'clip.mp4', size: 4, type: 'video/mp4', slice: () => 'chunk' } as unknown as File;

function clientWith(started: Record<string, unknown>) {
  const completeUpload = vi.fn(async () => ({ videoId: VIDEO_ID, status: 'UPLOADED' }));
  const issueUploadParts = vi.fn(async ({ query }: { query: { from: number } }) => ({
    parts: [{ partNumber: query.from, url: `https://example.invalid/part-${query.from}`, expiresAt: '' }],
  }));

  const client = {
    uploads: {
      startUpload: vi.fn(async () => started),
      completeUpload,
      issueUploadParts,
    },
  } as unknown as ApiClient;

  return { client, completeUpload, issueUploadParts };
}

describe('apps/web: upload orchestration', () => {
  beforeEach(() => {
    put.mockClear();
  });

  it('PUTs the whole file and completes with no parts on the single strategy', async () => {
    const { client, completeUpload } = clientWith({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'single',
      singleUrl: 'http://localhost:9000/raw/source.mp4',
      headers: { 'content-type': 'video/mp4' },
      expiresAt: '',
    });

    const progress: number[] = [];
    await uploadVideo(
      client,
      { file, filename: 'clip.mp4', sizeBytes: 4, contentType: 'video/mp4' },
      (percent) => progress.push(percent)
    );

    expect(put).toHaveBeenCalledWith('http://localhost:9000/raw/source.mp4', file, expect.anything());
    expect(completeUpload).toHaveBeenCalledWith({ params: { uploadId: UPLOAD_ID }, body: {} });
    expect(progress).toEqual([]);
  });

  it('refuses to upload when the API issued no single URL', async () => {
    const { client } = clientWith({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'single',
      expiresAt: '',
    });

    await expect(
      uploadVideo(client, { file, filename: 'clip.mp4', sizeBytes: 4, contentType: 'video/mp4' })
    ).rejects.toThrow(/did not issue an upload URL/);
  });

  it('uploads every part and completes with the collected etags', async () => {
    const { client, completeUpload, issueUploadParts } = clientWith({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'multipart',
      partSizeBytes: 2,
      partsExpected: 2,
      parts: [{ partNumber: 1, url: 'http://localhost:9000/raw/part-1', expiresAt: '' }],
      expiresAt: '',
    });

    const progress: number[] = [];
    await uploadVideo(
      client,
      { file, filename: 'clip.mp4', sizeBytes: 4, contentType: 'video/mp4' },
      (percent) => progress.push(percent)
    );

    expect(issueUploadParts).toHaveBeenCalledWith({
      params: { uploadId: UPLOAD_ID },
      query: { from: 2, count: 100 },
    });
    expect(completeUpload).toHaveBeenCalledWith({
      params: { uploadId: UPLOAD_ID },
      body: {
        parts: [
          { partNumber: 1, etag: 'part-etag' },
          { partNumber: 2, etag: 'part-etag' },
        ],
      },
    });
    expect(progress).toEqual([50, 100]);
  });

  it('refuses a multipart upload the API did not size', async () => {
    const { client } = clientWith({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'multipart',
      partsExpected: 2,
      parts: [],
      expiresAt: '',
    });

    await expect(
      uploadVideo(client, { file, filename: 'clip.mp4', sizeBytes: 4, contentType: 'video/mp4' })
    ).rejects.toThrow(/did not report a part size/);
  });
});
