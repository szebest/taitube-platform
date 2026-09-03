import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildApp } from '@vp/api';
import { createDbClient, seedDatabase, videos } from '@vp/db';
import { mintToken } from '@vp/dev-token';
import { createStorageClient } from '@vp/storage';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClientCrashedError, UploadClient } from '../client.js';

describe('tools/upload-client Reference Upload Client (Ticket 11: AC 18)', () => {
  let app: FastifyInstance;
  let apiPort: number;
  let s3Server: http.Server;
  let s3Port: number;
  const { db, sql } = createDbClient();

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

  let tempFilePath: string;
  // 32 MB synthetic test file (with multipartThreshold = 8 MB, creates 4 parts of 8 MB)
  const PART_SIZE = 8 * 1024 * 1024;
  const TOTAL_SIZE = 4 * PART_SIZE; // 32 MB = 4 parts

  beforeAll(async () => {
    await seedDatabase();

    authToken = mintToken({
      sub: DEV_USER_ID,
      role: 'user',
      ttl: '2h',
    });

    // Create 32 MB temporary file
    tempFilePath = path.join(os.tmpdir(), `test-multipart-${Date.now()}.mp4`);
    const chunk = Buffer.alloc(1024 * 1024, 0xaa);
    const fd = fs.openSync(tempFilePath, 'w');
    for (let i = 0; i < 32; i++) {
      fs.writeSync(fd, chunk);
    }
    fs.closeSync(fd);

    // Mock S3 storage server
    s3Server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${s3Port}`);
      const pathname = url.pathname;
      const key = pathname.replace(/^\/raw\//, '');

      // CreateMultipartUpload
      if (req.method === 'POST' && url.searchParams.has('uploads')) {
        const uploadId = `s3-mp-${Date.now()}`;
        multipartUploads.set(uploadId, { key, parts: [] });
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(
          `<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`
        );
        return;
      }

      // UploadPart
      if (
        req.method === 'PUT' &&
        url.searchParams.has('partNumber') &&
        url.searchParams.has('uploadId')
      ) {
        const uploadId = url.searchParams.get('uploadId') || '';
        const partNumber = Number(url.searchParams.get('partNumber') || 1);
        const etag = `"etag-${partNumber}"`;

        let len = 0;
        req.on('data', (c) => {
          len += c.length;
        });
        req.on('end', () => {
          const up = multipartUploads.get(uploadId);
          if (up) {
            up.parts.push({ partNumber, etag: `etag-${partNumber}`, size: len || PART_SIZE });
          }
          res.writeHead(200, { ETag: etag });
          res.end();
        });
        return;
      }

      // ListParts
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

      // CompleteMultipartUpload
      if (req.method === 'POST' && url.searchParams.has('uploadId')) {
        const uploadId = url.searchParams.get('uploadId') || '';
        const up = multipartUploads.get(uploadId);
        if (!up) {
          res.writeHead(404);
          res.end();
          return;
        }

        let total = 0;
        for (const p of up.parts) total += p.size;
        completedObjects.set(key, { size: total, contentType: 'video/mp4' });

        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(
          `<CompleteMultipartUploadResult><Location>http://localhost/raw/${key}</Location><ETag>"final-etag"</ETag></CompleteMultipartUploadResult>`
        );
        return;
      }

      // HeadObject
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

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      s3Server.listen(0, '127.0.0.1', () => {
        s3Port = (s3Server.address() as import('node:net').AddressInfo).port;
        resolve();
      });
    });

    const s3Client = createStorageClient({
      endpoint: `http://127.0.0.1:${s3Port}`,
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    });

    const mockRedis = {
      status: 'ready',
      ping: async () => 'PONG',
      on: () => {},
      quit: async () => 'OK',
      disconnect: () => {},
    } as unknown as import('ioredis').Redis;

    app = await buildApp({
      db,
      redisClient: mockRedis,
      s3Client,
      rawBucket: 'raw',
      multipartThresholdBytes: 8 * 1024 * 1024, // 8 MB threshold so 32 MB triggers multipart
    });

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    apiPort = Number(new URL(address).port);
  });

  afterAll(async () => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    await app.close();
    (s3Server as any).closeAllConnections?.();
    await new Promise((resolve) => s3Server.close(resolve));
    await sql.end();
  });

  it('AC 18: uploads file with concurrency 4, survives crash at 50%, resumes from ListParts and reaches UPLOADED', async () => {
    const client = new UploadClient({
      apiBaseUrl: `http://127.0.0.1:${apiPort}`,
      token: authToken,
    });

    // 1. Initial upload attempt: starts upload and crashes at 50% (killAtPercent: 50)
    let crashedUploadId = '';
    let crashedErrorCaught = false;

    // Step A: Initialize upload
    const init = await client.initUpload({
      filename: 'crash-and-resume.mp4',
      sizeBytes: TOTAL_SIZE,
      contentType: 'video/mp4',
    });
    crashedUploadId = init.uploadId;

    // Step B: Start upload with killAtPercent: 50
    try {
      await client.uploadFile({
        filePath: tempFilePath,
        concurrency: 4,
        existingUploadId: crashedUploadId,
        killAtPercent: 50,
      });
    } catch (err) {
      if (err instanceof ClientCrashedError) {
        crashedErrorCaught = true;
      } else {
        throw err;
      }
    }

    expect(crashedErrorCaught).toBe(true);

    // Verify intermediate state via GET /v1/uploads/:id (backed by S3 ListParts)
    const resumeInfo = await client.getResumeInfo(crashedUploadId);
    expect(resumeInfo.status).toBe('OPEN');
    expect(resumeInfo.strategy).toBe('multipart');
    expect(resumeInfo.partsExpected).toBe(4);
    expect(resumeInfo.uploadedParts).toBeDefined();
    expect(resumeInfo.uploadedParts?.length).toBeGreaterThanOrEqual(2);
    expect(resumeInfo.uploadedParts?.length).toBeLessThan(4);

    // 2. Restarted client resumes upload using ListParts / existingUploadId
    const resumed = await client.uploadFile({
      filePath: tempFilePath,
      concurrency: 4,
      existingUploadId: crashedUploadId,
      // No killAtPercent this time: let it complete!
    });

    expect(resumed.uploadId).toBe(crashedUploadId);
    expect(resumed.status).toBe('UPLOADED');

    // 3. Database assertion: video reaches UPLOADED status
    const [video] = await db.select().from(videos).where(eq(videos.id, resumed.videoId));
    expect(video).toBeDefined();
    expect(video?.status).toBe('UPLOADED');
    expect(video?.sourceSizeBytes).toBe(TOTAL_SIZE);
  }, 30000);
});
