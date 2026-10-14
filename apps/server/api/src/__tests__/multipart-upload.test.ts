import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { type FakeS3, startFakeS3 } from './fake-s3';
import { MockProbeJobQueue } from './mock-probe-queue';
import { TOKENS, bearer, buildTestApp } from './test-app';
import { completeUpload, postUpload } from './upload-requests';

const MB = 1024 * 1024;
const PART_SIZE = 8 * MB;
const BOTH_PARTS = [
  { partNumber: 1, etag: 'etag-1' },
  { partNumber: 2, etag: 'etag-2' },
];

describe('multipart upload with resume and abort', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let s3: FakeS3;
  const probeQueue = new MockProbeJobQueue();
  const token = TOKENS.user;

  function s3UploadOf(partUrl: string) {
    const upload = s3.multipartUploads.get(new URL(partUrl).searchParams.get('uploadId') ?? '');
    if (!upload) throw new Error('multipart upload was not initiated in storage');
    return upload;
  }

  beforeAll(async () => {
    s3 = await startFakeS3();
    ({ app, repositories } = await buildTestApp({
      config: inProcessAppConfig({ limits: { multipartThresholdBytes: 10 * MB } }),
      adapters: { storage: s3.storage, multipart: s3.multipart, probeQueue },
    }));
  });

  afterAll(async () => {
    await app.close();
    await s3.close();
  });

  it('picks the multipart strategy for a large file, with a clamped part size and a first batch of URLs', async () => {
    const fourGb = 4 * 1024 * MB;
    const res = await postUpload(app, token, {
      filename: 'large-movie.mp4',
      sizeBytes: fourGb,
      title: '4GB Movie',
    });

    expect(res.statusCode).toBe(201);
    const data = res.json();
    expect(data.strategy).toBe('multipart');
    expect(data.partSizeBytes).toBe(inProcessAppConfig().limits.partSizeMinBytes);
    expect(data.partsExpected).toBe(512);
    expect(data.parts).toHaveLength(100);

    const firstPart = data.parts[0];
    expect(firstPart.partNumber).toBe(1);
    expect(firstPart.url).toContain('partNumber=1');
    expect(firstPart.url).toContain('uploadId=');
    expect(firstPart.expiresAt).toBeDefined();

    const video = expectOk(await repositories.videos.findById(data.videoId));
    expect(video?.status).toBe('UPLOADING');
    expect(video?.sourceSizeBytes).toBe(fourGb);
  });

  it('returns the next batch of presigned part URLs', async () => {
    const initRes = await postUpload(app, token, {
      filename: 'large.mp4',
      sizeBytes: 200 * PART_SIZE,
    });
    const { uploadId } = initRes.json();

    const partsRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/parts?from=101&count=100`,
      headers: bearer(token),
    });

    expect(partsRes.statusCode).toBe(200);
    const { parts } = partsRes.json();
    expect(parts).toHaveLength(100);
    expect(parts[0].partNumber).toBe(101);
    expect(parts[99].partNumber).toBe(200);
  });

  it('reports the uploaded parts for a resume and completes once the rest arrive', async () => {
    const initRes = await postUpload(app, token, {
      filename: 'resume-test.mp4',
      sizeBytes: 2 * PART_SIZE,
    });
    const { uploadId, parts } = initRes.json();
    const upload = s3UploadOf(parts[0].url);
    upload.parts.push({ partNumber: 1, etag: 'etag-1', size: PART_SIZE });

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${uploadId}`,
      headers: bearer(token),
    });

    expect(getRes.statusCode).toBe(200);
    const resumeData = getRes.json();
    expect(resumeData).toMatchObject({ status: 'OPEN', strategy: 'multipart', partsExpected: 2 });
    expect(resumeData.uploadedParts).toEqual([{ partNumber: 1, etag: 'etag-1', size: PART_SIZE }]);

    upload.parts.push({ partNumber: 2, etag: 'etag-2', size: PART_SIZE });

    const completeRes = await completeUpload(app, token, uploadId, BOTH_PARTS);

    expect(completeRes.statusCode).toBe(202);
    const compData = completeRes.json();
    expect(compData.status).toBe('UPLOADED');
    expect(probeQueue.jobs.some((j) => j.data.videoId === compData.videoId)).toBe(true);
  });

  it('rejects a completion that lists fewer parts than expected with 422 VALIDATION_FAILED', async () => {
    const initRes = await postUpload(app, token, {
      filename: 'missing-parts.mp4',
      sizeBytes: 2 * PART_SIZE,
    });
    const { uploadId } = initRes.json();

    const completeRes = await completeUpload(app, token, uploadId, [
      { partNumber: 1, etag: 'etag-1' },
    ]);

    expect(completeRes.statusCode).toBe(422);
    expect(completeRes.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('rejects the upload and marks the video REJECTED when the stored size differs', async () => {
    const initRes = await postUpload(app, token, {
      filename: 'mismatch.mp4',
      sizeBytes: 2 * PART_SIZE,
    });
    const { uploadId, parts, videoId } = initRes.json();
    const upload = s3UploadOf(parts[0].url);
    upload.parts.push({ partNumber: 1, etag: 'etag-1', size: 4 * MB });
    upload.parts.push({ partNumber: 2, etag: 'etag-2', size: 4 * MB });

    const completeRes = await completeUpload(app, token, uploadId, BOTH_PARTS);

    expect(completeRes.statusCode).toBe(422);
    expect(completeRes.json().code).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);

    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('REJECTED');
    expect(video?.errorCode).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
  });

  it('aborts the multipart upload and marks the video ABANDONED on DELETE', async () => {
    const initRes = await postUpload(app, token, {
      filename: 'abort-test.mp4',
      sizeBytes: 2 * PART_SIZE,
    });
    const { uploadId, videoId, parts } = initRes.json();
    const s3UploadId = new URL(parts[0].url).searchParams.get('uploadId') ?? '';
    expect(s3.multipartUploads.has(s3UploadId)).toBe(true);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/uploads/${uploadId}`,
      headers: bearer(token),
    });
    expect(deleteRes.statusCode).toBe(204);
    expect(s3.multipartUploads.has(s3UploadId)).toBe(false);

    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('ABANDONED');

    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.some((e) => e.type === 'upload.aborted')).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${uploadId}`,
      headers: bearer(token),
    });
    expect(getRes.statusCode).toBe(410);
    expect(getRes.json().code).toBe(ErrorCodes.UPLOAD_NOT_OPEN);
  });
});
