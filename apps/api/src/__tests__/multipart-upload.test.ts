import * as http from 'node:http';
import { S3MultipartStorage, S3StorageClient } from '@vp/adapters/s3';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { MockProbeJobQueue } from './mock-probe-queue';

describe('apps/api Multipart Upload with Resume and Abort (Ticket 11: AC 17, 18, 19, 20)', () => {
  let app: FastifyInstance;
  let s3Server: http.Server;
  let s3Port: number;
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();

  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  let authToken: string;

  // Mock S3 multipart storage state
  interface MockPart {
    partNumber: number;
    etag: string;
    size: number;
  }
  const multipartUploads = new Map<string, { key: string; parts: MockPart[] }>();
  const completedObjects = new Map<string, { size: number; contentType: string }>();

  // Probe queue recording
  const mockProbeQueue = new MockProbeJobQueue();
  const probeJobs = mockProbeQueue.jobs;

  beforeAll(async () => {
    authToken = mintToken({
      sub: DEV_USER_ID,
      role: 'user',
      ttl: '2h',
    });

    // 1. Mock S3 server handling CreateMultipartUpload, UploadPart, ListParts, CompleteMultipartUpload, AbortMultipartUpload, HeadObject, DeleteObject
    s3Server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${s3Port}`);
      const pathname = url.pathname; // e.g. /raw/videoId/source.mp4
      const key = pathname.replace(/^\/raw\//, '');

      // CreateMultipartUpload: POST /raw/... ?uploads
      if (req.method === 'POST' && url.searchParams.has('uploads')) {
        const uploadId = `mp-${Date.now()}`;
        multipartUploads.set(uploadId, { key, parts: [] });
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(
          `<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`
        );
        return;
      }

      // UploadPart: PUT /raw/... ?partNumber=N&uploadId=X
      if (
        req.method === 'PUT' &&
        url.searchParams.has('partNumber') &&
        url.searchParams.has('uploadId')
      ) {
        const uploadId = url.searchParams.get('uploadId') || '';
        const partNumber = Number(url.searchParams.get('partNumber') || 1);
        const etag = `"etag-${partNumber}"`;

        let bodyLen = 0;
        req.on('data', (chunk) => {
          bodyLen += chunk.length;
        });
        req.on('end', () => {
          const up = multipartUploads.get(uploadId);
          if (up) {
            up.parts.push({ partNumber, etag: etag.replace(/"/g, ''), size: bodyLen || 8388608 });
          }
          res.writeHead(200, { ETag: etag });
          res.end();
        });
        return;
      }

      // ListParts: GET /raw/... ?uploadId=X
      if (req.method === 'GET' && url.searchParams.has('uploadId')) {
        const uploadId = url.searchParams.get('uploadId') || '';
        const up = multipartUploads.get(uploadId);
        if (!up) {
          res.writeHead(404);
          res.end();
          return;
        }

        const partsXml = up.parts
          .map(
            (p) =>
              `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag><Size>${p.size}</Size></Part>`
          )
          .join('');
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(`<ListPartsResult><IsTruncated>false</IsTruncated>${partsXml}</ListPartsResult>`);
        return;
      }

      // CompleteMultipartUpload: POST /raw/... ?uploadId=X
      if (req.method === 'POST' && url.searchParams.has('uploadId')) {
        const uploadId = url.searchParams.get('uploadId') || '';
        const up = multipartUploads.get(uploadId);
        if (!up) {
          res.writeHead(404);
          res.end();
          return;
        }

        let totalSize = 0;
        for (const p of up.parts) totalSize += p.size;

        completedObjects.set(key, {
          size: totalSize,
          contentType: 'video/mp4',
        });

        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(
          `<CompleteMultipartUploadResult><Location>http://localhost/raw/${key}</Location><ETag>"final-etag"</ETag></CompleteMultipartUploadResult>`
        );
        return;
      }

      // AbortMultipartUpload: DELETE /raw/... ?uploadId=X
      if (req.method === 'DELETE' && url.searchParams.has('uploadId')) {
        const uploadId = url.searchParams.get('uploadId') || '';
        multipartUploads.delete(uploadId);
        res.writeHead(204);
        res.end();
        return;
      }

      // HeadObject: HEAD /raw/...
      if (req.method === 'HEAD') {
        const obj = completedObjects.get(key);
        if (!obj) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'content-length': String(obj.size),
          'content-type': obj.contentType,
          ETag: '"final-etag"',
        });
        res.end();
        return;
      }

      // DeleteObject: DELETE /raw/...
      if (req.method === 'DELETE') {
        completedObjects.delete(key);
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      s3Server.listen(0, '127.0.0.1', () => {
        s3Port = (s3Server.address() as import('node:net').AddressInfo).port;
        resolve();
      });
    });

    const s3Client = new S3StorageClient({
      type: 'connection',
      healthBucket: 'raw',
      endpoint: `http://127.0.0.1:${s3Port}`,
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    });

    const multipart = new S3MultipartStorage({ type: 'storage', storageClient: s3Client });

    app = await buildApp({
      adapters: {
        repositories,
        cache,
        storage: s3Client,
        multipart,
        probeQueue: mockProbeQueue,
      },
      config: inProcessAppConfig({ limits: { multipartThresholdBytes: 10 * 1024 * 1024 } }),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => s3Server.close(resolve));
  });

  it('AC 17: POST /v1/uploads selects multipart strategy for files > 100 MB with clamped part size and batched URLs', async () => {
    // 4 GB file (4294967296 bytes)
    const fourGb = 4 * 1024 * 1024 * 1024;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'large-movie.mp4',
        sizeBytes: fourGb,
        contentType: 'video/mp4',
        title: '4GB Movie',
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.strategy).toBe('multipart');
    expect(data.partSizeBytes).toBe(inProcessAppConfig().limits.partSizeMinBytes);
    expect(data.partsExpected).toBe(512); // 4GB / 8MB = 512 parts
    expect(data.parts.length).toBe(100); // Batched to first 100 parts (AC 17)

    // Verify part URL format and expiry
    const firstPart = data.parts[0];
    expect(firstPart.partNumber).toBe(1);
    expect(firstPart.url).toContain('partNumber=1');
    expect(firstPart.url).toContain('uploadId=');
    expect(firstPart.expiresAt).toBeDefined();

    // Verify video in DB is UPLOADING
    const video = expectOk(await repositories.videos.findById(data.videoId));
    expect(video?.status).toBe('UPLOADING');
    expect(video?.sourceSizeBytes).toBe(fourGb);
  });

  it('AC 17: POST /v1/uploads/:id/parts returns next batch of presigned part URLs', async () => {
    // Start 1.6 GB upload (200 parts)
    const size = 200 * 8 * 1024 * 1024;
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'large.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    const { uploadId } = JSON.parse(initRes.body);

    // Request parts 101 to 200
    const partsRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/parts?from=101&count=100`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(partsRes.statusCode).toBe(200);
    const data = JSON.parse(partsRes.body);
    expect(data.parts.length).toBe(100);
    expect(data.parts[0].partNumber).toBe(101);
    expect(data.parts[99].partNumber).toBe(200);
  });

  it('AC 18: GET /v1/uploads/:id returns uploaded parts for resume inspection', async () => {
    // 16 MB file (2 parts of 8 MB)
    const partSize = 8 * 1024 * 1024;
    const size = 2 * partSize;

    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'resume-test.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    const { uploadId, parts } = JSON.parse(initRes.body);

    // Simulate client uploading part 1
    const part1Url = new URL(parts[0].url);
    const s3UploadId = part1Url.searchParams.get('uploadId') || '';
    const up = multipartUploads.get(s3UploadId);
    expect(up).toBeDefined();
    up?.parts.push({ partNumber: 1, etag: 'etag-1', size: partSize });

    // Client crashes and later calls GET /v1/uploads/:id to resume (AC 18)
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${uploadId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const resumeData = JSON.parse(getRes.body);
    expect(resumeData.status).toBe('OPEN');
    expect(resumeData.strategy).toBe('multipart');
    expect(resumeData.partsExpected).toBe(2);
    expect(resumeData.uploadedParts.length).toBe(1);
    expect(resumeData.uploadedParts[0]).toEqual({
      partNumber: 1,
      etag: 'etag-1',
      size: partSize,
    });

    // Client uploads part 2 and completes upload
    up?.parts.push({ partNumber: 2, etag: 'etag-2', size: partSize });

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        parts: [
          { partNumber: 1, etag: 'etag-1' },
          { partNumber: 2, etag: 'etag-2' },
        ],
      },
    });

    expect(completeRes.statusCode).toBe(202);
    const compData = JSON.parse(completeRes.body);
    expect(compData.status).toBe('UPLOADED');

    // Probe job enqueued
    expect(probeJobs.some((j) => j.data['videoId'] === compData.videoId)).toBe(true);
  });

  it('AC 19: complete with missing parts returns 422 VALIDATION_FAILED', async () => {
    const size = 16 * 1024 * 1024;
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'missing-parts.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    const { uploadId } = JSON.parse(initRes.body);

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        parts: [
          // Missing part 2!
          { partNumber: 1, etag: 'etag-1' },
        ],
      },
    });

    expect(completeRes.statusCode).toBe(422);
    const body = JSON.parse(completeRes.body);
    expect(body.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('AC 19: HeadObject size mismatch rejects upload and marks video REJECTED', async () => {
    const size = 16 * 1024 * 1024; // 16 MB declared
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'mismatch.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    const { uploadId, parts, videoId } = JSON.parse(initRes.body);

    // Simulate parts uploaded with corrupted/smaller size (e.g. only 8 MB instead of 16 MB)
    const part1Url = new URL(parts[0].url);
    const s3UploadId = part1Url.searchParams.get('uploadId') || '';
    const up = multipartUploads.get(s3UploadId);
    up?.parts.push({ partNumber: 1, etag: 'etag-1', size: 4 * 1024 * 1024 });
    up?.parts.push({ partNumber: 2, etag: 'etag-2', size: 4 * 1024 * 1024 });

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        parts: [
          { partNumber: 1, etag: 'etag-1' },
          { partNumber: 2, etag: 'etag-2' },
        ],
      },
    });

    expect(completeRes.statusCode).toBe(422);
    const body = JSON.parse(completeRes.body);
    expect(body.code).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);

    // Verify video is marked REJECTED in database
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('REJECTED');
    expect(video?.errorCode).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
  });

  it('AC 20: DELETE /v1/uploads/:id aborts multipart and marks video ABANDONED', async () => {
    const size = 16 * 1024 * 1024;
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'abort-test.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    const { uploadId, videoId, parts } = JSON.parse(initRes.body);
    const s3UploadId = new URL(parts[0].url).searchParams.get('uploadId') || '';

    expect(multipartUploads.has(s3UploadId)).toBe(true);

    // Abort upload
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/uploads/${uploadId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // Invariant: Multipart upload aborted in storage
    expect(multipartUploads.has(s3UploadId)).toBe(false);

    // Invariant: Video status marked ABANDONED in DB
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('ABANDONED');

    // Invariant: video_events has upload.aborted event
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.some((e) => e.type === 'upload.aborted')).toBe(true);

    // Subsequent GET returns 410 with UPLOAD_NOT_OPEN
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${uploadId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(getRes.statusCode).toBe(410);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.code).toBe(ErrorCodes.UPLOAD_NOT_OPEN);
  });
});
