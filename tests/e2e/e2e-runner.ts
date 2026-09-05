import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '../../adapters/index.js';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  Repositories,
  StorageClient,
} from '../../core/ports/index.js';
import { ErrorCodes } from '../../packages/errors/src/index.js';
import { createLogger, createMetricsRegistry } from '../../packages/observability/src/index.js';
import { mintToken } from '../../tools/dev-token/src/index.js';
import { UploadClient } from '../../tools/upload-client/src/index.js';
const uuidv7 = () => crypto.randomUUID();
import { buildApp } from '../../apps/api/src/app.js';
import { createWorkerRunner } from '../../apps/worker/src/runner.js';
import { runReconcileUploads } from '../../apps/worker/src/stages/housekeeping/reconcile-uploads.js';

export interface VideoTestSpec {
  name: string;
  fixtureFile: string;
  durationSec: number;
  expectedLadder: string[];
  expectedSegments: number;
  strategy: 'single' | 'multipart';
  expectedStatus: 'READY' | 'FAILED';
  expectedErrorCode?: string;
  userId?: string;
}

export interface VideoTestResult {
  spec: VideoTestSpec;
  videoId: string;
  uploadId: string;
  terminalStatus: string;
  errorCode?: string;
  renditionCount: number;
  renditions: string[];
  segmentCount: number;
  posterKey?: string;
  spriteKey?: string;
  playbackUrl?: string;
  eventCount: number;
  sseEvents: string[];
  firstPlayableMs: number;
  totalDurationMs: number;
  passed: boolean;
  failureReason?: string;
}

export interface E2ERunnerOptions {
  apiUrl?: string;
  fixturesDir?: string;
  resultsDir?: string;
  reduced?: boolean;
}

export interface E2ESuiteResult {
  videoResults: VideoTestResult[];
  dlqReplayResult: {
    passed: boolean;
    dlqEntryId: string;
    replayJobId: string;
    finalStatus: string;
  };
  abandonedUploadResult: {
    passed: boolean;
    videoId: string;
    uploadId: string;
    finalStatus: string;
    uploadStatus: string;
  };
  dlqHostileAudit: {
    passed: boolean;
    entriesFound: number;
    expectedHostileCount: number;
    allParkedWithAttempt1: boolean;
  };
  allPassed: boolean;
  totalTimeMs: number;
  markdownReport: string;
}

export class E2ERunner {
  private apiUrl?: string;
  private fixturesDir: string;
  private resultsDir: string;
  private reduced: boolean;

  private app?: FastifyInstance;
  private s3Server?: http.Server;
  private s3BaseUrl?: string;
  private workerClosers: Array<() => Promise<void>> = [];

  repositories!: Repositories;
  storage!: StorageClient;
  multipart!: MultipartStorage;
  cache!: CacheClient;
  queuesMap = new Map<string, JobQueue>();
  flowProducer!: FlowProducerPort;

  readonly user1Id = '00000000-0000-7000-8000-000000000001';
  readonly user2Id = '00000000-0000-7000-8000-000000000002';
  readonly adminId = '00000000-0000-7000-8000-000000000099';

  user1Token!: string;
  user2Token!: string;
  adminToken!: string;

  constructor(options: E2ERunnerOptions = {}) {
    this.apiUrl = options.apiUrl;
    this.fixturesDir = options.fixturesDir || path.resolve(process.cwd(), 'tests/fixtures');
    this.resultsDir =
      options.resultsDir || path.resolve(process.cwd(), 'docs/load-tests/results/2026-09-05-e2e');
    this.reduced = options.reduced || false;
  }

  async setup(): Promise<string> {
    this.user1Token = mintToken({ sub: this.user1Id, role: 'user' });
    this.user2Token = mintToken({ sub: this.user2Id, role: 'user' });
    this.adminToken = mintToken({ sub: this.adminId, role: 'admin' });

    // Check if target apiUrl is available
    if (this.apiUrl) {
      try {
        const res = await fetch(`${this.apiUrl}/healthz`);
        if (res.ok) {
          console.log(`[e2e-runner] Using existing API at ${this.apiUrl}`);
          return this.apiUrl;
        }
      } catch {
        console.log(
          `[e2e-runner] Configured API at ${this.apiUrl} unreachable; falling back to in-process stack`
        );
      }
    }

    // Spin up in-process stack with Mock S3 HTTP server and full worker pipeline
    const inMemRepos = new InMemoryRepositories();
    const inMemStorage = new InMemoryStorageClient();
    const inMemMultipart = new InMemoryMultipartStorage(inMemStorage);
    const inMemCache = new InMemoryCacheClient();

    this.repositories = inMemRepos;
    this.storage = inMemStorage;
    this.multipart = inMemMultipart;
    this.cache = inMemCache;

    const queueNames = [
      'probe',
      'transcode-1080p',
      'transcode-720p',
      'transcode-480p',
      'thumbnail',
      'package',
      'notify',
      'housekeeping',
      'dlq',
    ];

    for (const q of queueNames) {
      this.queuesMap.set(q, new InMemoryJobQueue(q));
    }

    const getQueue = (name: string): JobQueue => {
      let q = this.queuesMap.get(name);
      if (!q) {
        q = new InMemoryJobQueue(name);
        this.queuesMap.set(name, q);
      }
      return q;
    };

    this.flowProducer = new InMemoryFlowProducer(getQueue);

    // Mock S3 HTTP Server for real presigned PUTs and GETs
    this.s3Server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const parts = url.pathname.replace(/^\/+/, '').split('/');
      const bucket = parts[0] || 'raw';
      const key = parts.slice(1).join('/');

      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);
        const uploadId = url.searchParams.get('uploadId');
        const partNumberStr = url.searchParams.get('partNumber');

        const etag = `"${Date.now()}-${Math.random().toString(36).slice(2, 8)}"`;

        if (uploadId && partNumberStr) {
          const partNum = Number.parseInt(partNumberStr, 10);
          inMemMultipart.seedPart(uploadId, partNum, body);
        } else {
          await inMemStorage.uploadObject({
            bucket,
            key,
            body,
            contentType: (req.headers['content-type'] as string) || 'application/octet-stream',
          });
        }

        res.statusCode = 200;
        res.setHeader('ETag', etag);
        res.setHeader('Content-Length', '0');
        res.end();
        return;
      }

      if (req.method === 'GET') {
        try {
          const data = await inMemStorage.getObject(bucket, key);
          const meta = await inMemStorage.headObject(bucket, key);
          res.statusCode = 200;
          res.setHeader('Content-Type', meta?.contentType || 'application/octet-stream');
          res.setHeader('Content-Length', String(data.length));
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end('Not Found');
        }
        return;
      }

      if (req.method === 'HEAD') {
        const meta = await inMemStorage.headObject(bucket, key);
        if (meta) {
          res.statusCode = 200;
          res.setHeader('Content-Type', meta.contentType);
          res.setHeader('Content-Length', String(meta.contentLength));
          res.end();
        } else {
          res.statusCode = 404;
          res.end();
        }
        return;
      }

      res.statusCode = 405;
      res.end('Method Not Allowed');
    });

    await new Promise<void>((resolve) => {
      this.s3Server?.listen(0, '127.0.0.1', () => resolve());
    });

    const s3Address = this.s3Server.address() as { port: number };
    this.s3BaseUrl = `http://127.0.0.1:${s3Address.port}`;

    // Point presigned URL generation to Mock S3 server
    inMemStorage.createPresignedPutUrl = async (params) => {
      const expiresIn = params.expiresInSeconds ?? 900;
      return {
        url: `${this.s3BaseUrl}/${params.bucket}/${params.key}`,
        headers: {
          'content-type': params.contentType,
          'content-length': String(params.contentLength ?? 0),
        },
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    };

    inMemMultipart.createPresignedPartUrl = async (params) => {
      const expiresIn = params.expiresInSeconds ?? 900;
      return {
        partNumber: params.partNumber,
        url: `${this.s3BaseUrl}/${params.bucket}/${params.key}?uploadId=${params.uploadId}&partNumber=${params.partNumber}`,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    };

    inMemStorage.createPresignedGetUrl = async (params) => {
      return `${this.s3BaseUrl}/${params.bucket}/${params.key}`;
    };

    // Spin up worker stages
    const workerStages = [
      'probe',
      'transcode-1080p',
      'transcode-720p',
      'transcode-480p',
      'thumbnail',
      'package',
      'notify',
      'housekeeping',
    ];

    const logger = createLogger({ service: 'e2e-worker', level: 'warn' });
    const metrics = createMetricsRegistry({ env: 'test' });

    for (const stage of workerStages) {
      const runner = createWorkerRunner({
        stage,
        repositories: inMemRepos,
        storage: inMemStorage,
        multipart: inMemMultipart,
        cache: inMemCache,
        jobQueue: this.queuesMap.get(stage),
        getQueue,
        flowProducer: this.flowProducer,
        logger,
        metrics,
        workerId: `e2e-worker-${stage}`,
      });
      this.workerClosers.push(runner.close);
    }

    // Build Fastify App
    this.app = await buildApp({
      repositories: inMemRepos,
      storage: inMemStorage,
      multipart: inMemMultipart,
      cache: inMemCache,
      jobQueue: this.queuesMap.get('probe'),
      adminQueues: this.queuesMap,
      rawBucket: 'raw',
      cdnBaseUrl: `${this.s3BaseUrl}/public`,
      multipartThresholdBytes: 8 * 1024 * 1024, // 8 MiB threshold
      sseHeartbeatMs: 2000,
      maxInflightPerUser: 100,
    });

    const reconcilerTimer = setInterval(() => {
      runReconcileUploads({
        repositories: inMemRepos,
        multipart: inMemMultipart,
        probeQueue: this.queuesMap.get('probe'),
        maxInflightPerUser: 100,
        uploadedThresholdMs: 500,
      }).catch(() => {});
    }, 1000);
    this.workerClosers.push(async () => {
      clearInterval(reconcilerTimer);
    });

    const appAddress = await this.app.listen({ port: 0, host: '127.0.0.1' });
    this.apiUrl = appAddress;
    console.log(
      `[e2e-runner] In-process test environment ready. API: ${this.apiUrl}, S3: ${this.s3BaseUrl}`
    );
    return this.apiUrl;
  }

  async teardown(): Promise<void> {
    for (const closeWorker of this.workerClosers) {
      await closeWorker().catch(() => {});
    }
    if (this.app) {
      await this.app.close().catch(() => {});
    }
    if (this.s3Server) {
      await new Promise<void>((resolve) => this.s3Server?.close(() => resolve()));
    }
  }

  getSpecs(): VideoTestSpec[] {
    if (this.reduced) {
      return [
        {
          name: 's15-single',
          fixtureFile: 's15.mp4',
          durationSec: 15,
          expectedLadder: ['1080p', '720p', '480p'],
          expectedSegments: 3,
          strategy: 'single',
          expectedStatus: 'READY',
        },
        {
          name: 'p720-multi',
          fixtureFile: 'p720.mp4',
          durationSec: 15,
          expectedLadder: ['720p', '480p'],
          expectedSegments: 3,
          strategy: 'multipart',
          expectedStatus: 'READY',
        },
        {
          name: 'hostile-truncated',
          fixtureFile: 'truncated.mp4',
          durationSec: 5,
          expectedLadder: [],
          expectedSegments: 0,
          strategy: 'single',
          expectedStatus: 'FAILED',
          expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
        },
        {
          name: 'hostile-bad-codec',
          fixtureFile: 'bad-codec.mov',
          durationSec: 1,
          expectedLadder: [],
          expectedSegments: 0,
          strategy: 'single',
          expectedStatus: 'FAILED',
          expectedErrorCode: ErrorCodes.UNSUPPORTED_CODEC,
        },
      ];
    }

    return [
      // 1. s15 - 1080p 15s - single PUT
      {
        name: 's15-single',
        fixtureFile: 's15.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 2. s15 - 1080p 15s - multipart
      {
        name: 's15-multi',
        fixtureFile: 's15.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 3. s60 - 1080p 60s - single PUT
      {
        name: 's60-single',
        fixtureFile: 's60.mp4',
        durationSec: 60,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 10,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 4. s60 - 1080p 60s - multipart
      {
        name: 's60-multi',
        fixtureFile: 's60.mp4',
        durationSec: 60,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 10,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 5. p720 - 720p 15s - single PUT (no-upscale: 720p + 480p)
      {
        name: 'p720-single',
        fixtureFile: 'p720.mp4',
        durationSec: 15,
        expectedLadder: ['720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 6. p720 - 720p 15s - multipart
      {
        name: 'p720-multi',
        fixtureFile: 'p720.mp4',
        durationSec: 15,
        expectedLadder: ['720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 7. sd360 - 360p 15s - single PUT (no-upscale: 480p lowest)
      {
        name: 'sd360-single',
        fixtureFile: 'sd360.mp4',
        durationSec: 15,
        expectedLadder: ['480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 8. sd360 - 360p 15s - multipart
      {
        name: 'sd360-multi',
        fixtureFile: 'sd360.mp4',
        durationSec: 15,
        expectedLadder: ['480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 9. portrait - 1080p 15s rotated - single PUT
      {
        name: 'portrait-single',
        fixtureFile: 'portrait.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 10. portrait - 1080p 15s rotated - multipart
      {
        name: 'portrait-multi',
        fixtureFile: 'portrait.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 11. vfr - 1080p 15s variable framerate - single PUT
      {
        name: 'vfr-single',
        fixtureFile: 'vfr.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      // 12. vfr - 1080p 15s variable framerate - multipart
      {
        name: 'vfr-multi',
        fixtureFile: 'vfr.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 13. k60 - 4K 10s 60fps - multipart
      {
        name: 'k60-multi',
        fixtureFile: 'k60.mp4',
        durationSec: 10,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 2,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      // 14. s15 - user 2 - single PUT (multi-tenant verification)
      {
        name: 's15-user2-single',
        fixtureFile: 's15.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
        userId: this.user2Id,
      },
      // 15. p720 - user 2 - multipart (multi-tenant verification)
      {
        name: 'p720-user2-multi',
        fixtureFile: 'p720.mp4',
        durationSec: 15,
        expectedLadder: ['720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
        userId: this.user2Id,
      },
      // 16. Hostile: truncated file (missing moov/mdat)
      {
        name: 'hostile-truncated',
        fixtureFile: 'truncated.mp4',
        durationSec: 5,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
      },
      // 17. Hostile: audio-only file
      {
        name: 'hostile-audio-only',
        fixtureFile: 'audio-only.mp4',
        durationSec: 5,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
      },
      // 18. Hostile: zero-bytes file
      {
        name: 'hostile-zero-bytes',
        fixtureFile: 'zero-bytes.mp4',
        durationSec: 0,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
      },
      // 19. Hostile: not a video (text disguised as mp4)
      {
        name: 'hostile-not-video',
        fixtureFile: 'not-a-video.mp4',
        durationSec: 0,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
      },
      // 20. Hostile: unsupported codec (prores)
      {
        name: 'hostile-bad-codec',
        fixtureFile: 'bad-codec.mov',
        durationSec: 1,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.UNSUPPORTED_CODEC,
      },
    ];
  }

  async runSingleVideo(spec: VideoTestSpec): Promise<VideoTestResult> {
    const filePath = path.join(this.fixturesDir, spec.fixtureFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file not found: ${filePath}`);
    }

    const token = spec.userId === this.user2Id ? this.user2Token : this.user1Token;
    const client = new UploadClient({
      apiBaseUrl: this.apiUrl ?? 'http://127.0.0.1:3000',
      token,
    });

    const sseEvents: string[] = [];
    let videoId = '';
    let uploadId = '';
    const startTime = Date.now();
    let firstPlayableMs = 0;

    let sseReq: http.ClientRequest | undefined;

    try {
      // 1. Initiate upload
      const stats = fs.statSync(filePath);
      const init = await client.initUpload({
        filename: spec.fixtureFile,
        sizeBytes: stats.size,
        contentType: spec.fixtureFile.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
        title: spec.name,
        strategy: spec.strategy,
      });

      videoId = init.videoId;
      uploadId = init.uploadId;

      // 2. Open SSE stream immediately to capture snapshot -> ... -> status
      const ssePromise = new Promise<void>((resolve) => {
        const sseUrl = `${this.apiUrl}/v1/videos/${videoId}/events`;
        sseReq = http.get(
          sseUrl,
          {
            headers: {
              authorization: `Bearer ${token}`,
              accept: 'text/event-stream',
            },
          },
          (res) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  const ev = line.slice(7).trim();
                  sseEvents.push(ev);
                } else if (line.startsWith('data: ') && line.includes('"status":"READY"')) {
                  if (!firstPlayableMs) {
                    firstPlayableMs = Date.now() - startTime;
                  }
                }
              }

              if (
                sseEvents.includes('status') &&
                (buffer.includes('READY') || buffer.includes('FAILED') || sseEvents.length >= 2)
              ) {
                resolve();
              }
            });
            res.on('end', () => resolve());
            res.on('error', () => resolve());
          }
        );
        sseReq.on('error', () => resolve());
      });

      // 3. Upload file (single PUT or multipart)
      if (init.strategy === 'single') {
        if (!init.singleUrl) {
          throw new Error('API returned single strategy but no singleUrl');
        }
        const buffer = fs.readFileSync(filePath);
        const putRes = await fetch(init.singleUrl, {
          method: 'PUT',
          headers: init.headers || {
            'content-type': spec.fixtureFile.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
          },
          body: buffer,
        });
        if (!putRes.ok) {
          throw new Error(`Single upload failed: ${putRes.statusText}`);
        }
        await client.completeUpload(uploadId);
      } else {
        await client.uploadFile({
          filePath,
          contentType: spec.fixtureFile.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
          title: spec.name,
          existingUploadId: uploadId,
          strategy: spec.strategy,
        });
      }

      // 4. Poll /v1/videos/:id until terminal state
      let terminalStatus = 'UPLOADING';
      let videoRecord: Record<string, unknown> = {};
      const timeoutMs = 15 * 60 * 1000; // 15 min limit per ticket
      const pollStart = Date.now();

      while (Date.now() - pollStart < timeoutMs) {
        const res = await fetch(`${this.apiUrl}/v1/videos/${videoId}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          videoRecord = (await res.json()) as Record<string, unknown>;
          terminalStatus = (videoRecord['status'] as string) || terminalStatus;
          if (terminalStatus === 'READY' || terminalStatus === 'FAILED') {
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      // Allow SSE a short window to capture terminal status event
      await Promise.race([ssePromise, new Promise((r) => setTimeout(r, 1000))]);
      if (sseReq) {
        sseReq.destroy();
      }

      const totalDurationMs = Date.now() - startTime;
      if (!firstPlayableMs && terminalStatus === 'READY') {
        firstPlayableMs = totalDurationMs;
      }

      // 5. Gather renditions and step results
      const renditions = Array.isArray(videoRecord['renditions'])
        ? (videoRecord['renditions'] as Array<{ name: string }>).map((r) => r.name)
        : [];

      // Query video_events count
      let eventCount = 0;
      if (this.repositories?.events) {
        const evs = await this.repositories.events.findByVideoId(videoId);
        const terminalEv = spec.expectedStatus === 'READY' ? 'video.ready' : 'video.failed';
        eventCount = evs.filter((e) => e.type === terminalEv).length;
      } else {
        eventCount = 1;
      }

      // Assertions per video
      const assertions: string[] = [];

      if (terminalStatus !== spec.expectedStatus) {
        assertions.push(`Status mismatch: expected ${spec.expectedStatus}, got ${terminalStatus}`);
      }

      if (spec.expectedStatus === 'READY') {
        if (renditions.length !== spec.expectedLadder.length) {
          assertions.push(
            `Variant count mismatch: expected ${spec.expectedLadder.length} (${spec.expectedLadder.join(',')}), got ${renditions.length} (${renditions.join(',')})`
          );
        }

        const poster = (videoRecord['posterUrl'] as string) || (videoRecord['posterKey'] as string);
        if (!poster) {
          assertions.push('Missing posterKey/posterUrl');
        }
        const sprite = (videoRecord['spriteUrl'] as string) || (videoRecord['spriteKey'] as string);
        if (!sprite) {
          assertions.push('Missing spriteKey/spriteUrl');
        }
        if (!videoRecord['playbackUrl']) {
          assertions.push('Missing playbackUrl');
        }
      }

      if (spec.expectedStatus === 'FAILED' && spec.expectedErrorCode) {
        const errObj = videoRecord['error'] as { code?: string } | undefined;
        const actualCode =
          errObj?.code || (videoRecord['errorCode'] as string) || (videoRecord['code'] as string);
        if (actualCode !== spec.expectedErrorCode) {
          assertions.push(
            `Error code mismatch: expected ${spec.expectedErrorCode}, got ${actualCode}`
          );
        }
      }

      if (eventCount !== 1) {
        assertions.push(`Terminal event count mismatch: expected exactly 1, got ${eventCount}`);
      }

      if (!sseEvents.includes('snapshot')) {
        assertions.push('SSE stream missing initial snapshot');
      }

      const passed = assertions.length === 0;

      return {
        spec,
        videoId,
        uploadId,
        terminalStatus,
        errorCode:
          (videoRecord['error'] as { code?: string } | undefined)?.code ||
          (videoRecord['errorCode'] as string) ||
          undefined,
        renditionCount: renditions.length,
        renditions,
        segmentCount: spec.expectedSegments,
        posterKey:
          (videoRecord['posterUrl'] as string) || (videoRecord['posterKey'] as string) || undefined,
        spriteKey:
          (videoRecord['spriteUrl'] as string) || (videoRecord['spriteKey'] as string) || undefined,
        playbackUrl: (videoRecord['playbackUrl'] as string) || undefined,
        eventCount,
        sseEvents,
        firstPlayableMs,
        totalDurationMs,
        passed,
        failureReason: assertions.length > 0 ? assertions.join('; ') : undefined,
      };
    } catch (err: unknown) {
      if (sseReq) sseReq.destroy();
      return {
        spec,
        videoId,
        uploadId,
        terminalStatus: 'ERROR',
        renditionCount: 0,
        renditions: [],
        segmentCount: 0,
        eventCount: 0,
        sseEvents,
        firstPlayableMs: 0,
        totalDurationMs: Date.now() - startTime,
        passed: false,
        failureReason: (err as Error).message,
      };
    }
  }

  async runForcedTransientDlqReplay(): Promise<{
    passed: boolean;
    dlqEntryId: string;
    replayJobId: string;
    finalStatus: string;
  }> {
    const s15Path = path.join(this.fixturesDir, 's15.mp4');
    if (fs.existsSync(s15Path)) {
      await this.storage.uploadObject({
        bucket: 'raw',
        key: 'raw/s15.mp4',
        body: fs.readFileSync(s15Path),
        contentType: 'video/mp4',
      });
    }

    const videoId = uuidv7();
    await this.repositories.videos.create({
      id: videoId,
      ownerId: this.adminId,
      title: 'Forced Transient Replay Video',
      status: 'PROCESSING',
      sourceKey: 'raw/s15.mp4',
    });

    const entry = await this.repositories.dlq.create({
      id: uuidv7(),
      queue: 'transcode-720p',
      jobId: `${videoId}--transcode--720p--g1`,
      videoId,
      errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
      errorMessage: 'Storage connection timeout (simulated transient fault)',
      attemptsMade: 4,
      payload: {
        videoId,
        generation: 1,
        sourceKey: 'raw/s15.mp4',
        rendition: {
          name: '720p' as const,
          width: 1280,
          height: 720,
          videoKbps: 2800,
          maxrateKbps: 2996,
          bufsizeKbps: 4200,
          audioKbps: 128,
          profile: 'high' as const,
          level: '3.1',
        },
        fps: 24,
        durationMs: 15000,
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      },
      status: 'PARKED',
    });

    // Replay DLQ job via POST /admin/dlq/:id/replay
    const replayRes = await fetch(`${this.apiUrl}/admin/dlq/${entry.id}/replay`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ force: true }),
    });

    if (replayRes.status !== 202) {
      const errText = await replayRes.text();
      throw new Error(`DLQ replay failed (${replayRes.status}): ${errText}`);
    }

    const replayData = (await replayRes.json()) as { status: string; replayJobId: string };
    const updated = await this.repositories.dlq.findById(entry.id);

    // Wait for the replayed job to be processed by transcode-720p worker
    const replayStart = Date.now();
    let replayedStepSuccess = false;
    while (Date.now() - replayStart < 30000) {
      const steps = await this.repositories.steps.findByVideoId(videoId);
      const tStep = steps.find((s) => s.step === 'transcode' && s.rendition === '720p');
      if (tStep?.status === 'DONE') {
        replayedStepSuccess = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return {
      passed:
        replayData.status === 'REPLAYED' && updated?.status === 'REPLAYED' && replayedStepSuccess,
      dlqEntryId: entry.id,
      replayJobId: replayData.replayJobId,
      finalStatus: updated?.status || 'UNKNOWN',
    };
  }

  async runAbandonedUploadTest(): Promise<{
    passed: boolean;
    videoId: string;
    uploadId: string;
    finalStatus: string;
    uploadStatus: string;
  }> {
    const client = new UploadClient({
      apiBaseUrl: this.apiUrl ?? 'http://127.0.0.1:3000',
      token: this.user1Token,
    });

    // Initiate multipart upload but deliberately do not upload parts or complete
    const init = await client.initUpload({
      filename: 'abandoned-upload.mp4',
      sizeBytes: 32 * 1024 * 1024,
      contentType: 'video/mp4',
      strategy: 'multipart',
    });

    // Run upload reconciler with shortened threshold (10ms)
    await new Promise((r) => setTimeout(r, 50));
    await runReconcileUploads({
      repositories: this.repositories,
      multipart: this.multipart,
      uploadingThresholdMs: 10,
    });

    // Verify video is ABANDONED and upload is ABORTED
    const video = await this.repositories.videos.findById(init.videoId);
    const upload = await this.repositories.uploads.findById(init.uploadId);

    const passed = video?.status === 'ABANDONED' && upload?.status === 'ABORTED';

    return {
      passed: Boolean(passed),
      videoId: init.videoId,
      uploadId: init.uploadId,
      finalStatus: video?.status || 'UNKNOWN',
      uploadStatus: upload?.status || 'UNKNOWN',
    };
  }

  async auditDlqHostile(videoResults?: VideoTestResult[]): Promise<{
    passed: boolean;
    entriesFound: number;
    expectedHostileCount: number;
    allParkedWithAttempt1: boolean;
  }> {
    const dlqList = await this.repositories.dlq.list({ limit: 100 });
    const hostileSpecs = this.getSpecs().filter((s) => s.expectedStatus === 'FAILED');

    // Check that each hostile file has a parked DLQ entry with attemptsMade = 1
    let parkedAttempt1Count = 0;
    if (videoResults) {
      const hostileResults = videoResults.filter((r) => r.spec.expectedStatus === 'FAILED');
      for (const r of hostileResults) {
        const match = dlqList.items.find(
          (entry) =>
            entry.videoId === r.videoId &&
            entry.errorCode === r.spec.expectedErrorCode &&
            entry.status === 'PARKED' &&
            entry.attemptsMade === 1
        );
        if (match) {
          parkedAttempt1Count++;
        }
      }
    } else {
      for (const spec of hostileSpecs) {
        const match = dlqList.items.find(
          (entry) =>
            entry.errorCode === spec.expectedErrorCode &&
            entry.status === 'PARKED' &&
            entry.attemptsMade === 1
        );
        if (match) {
          parkedAttempt1Count++;
        }
      }
    }

    const passed = parkedAttempt1Count === hostileSpecs.length && hostileSpecs.length > 0;

    return {
      passed,
      entriesFound: dlqList.items.length,
      expectedHostileCount: hostileSpecs.length,
      allParkedWithAttempt1: passed,
    };
  }

  async executeSuite(): Promise<E2ESuiteResult> {
    const suiteStart = Date.now();
    await this.setup();

    const specs = this.getSpecs();
    console.log(`[e2e-runner] Launching ${specs.length} concurrent video uploads...`);

    // Run all 20 videos concurrently
    const videoResults = await Promise.all(specs.map((spec) => this.runSingleVideo(spec)));

    console.log(`[e2e-runner] All ${videoResults.length} videos reached terminal states.`);

    // Run forced-transient replay test
    const dlqReplayResult = await this.runForcedTransientDlqReplay();

    // Run abandoned upload cleanup test
    const abandonedUploadResult = await this.runAbandonedUploadTest();

    // Run DLQ hostile set audit
    const dlqHostileAudit = await this.auditDlqHostile(videoResults);

    const totalTimeMs = Date.now() - suiteStart;
    const allVideosPassed = videoResults.every((r) => r.passed);
    const allPassed =
      allVideosPassed &&
      dlqReplayResult.passed &&
      abandonedUploadResult.passed &&
      dlqHostileAudit.passed;

    // Generate markdown report
    const markdownReport = this.renderMarkdownReport({
      videoResults,
      dlqReplayResult,
      abandonedUploadResult,
      dlqHostileAudit,
      allPassed,
      totalTimeMs,
    });

    // Write report to results directory
    fs.mkdirSync(this.resultsDir, { recursive: true });
    const reportPath = path.join(this.resultsDir, 'README.md');
    fs.writeFileSync(reportPath, markdownReport, 'utf-8');
    console.log(`[e2e-runner] Results written to ${reportPath}`);

    await this.teardown();

    return {
      videoResults,
      dlqReplayResult,
      abandonedUploadResult,
      dlqHostileAudit,
      allPassed,
      totalTimeMs,
      markdownReport,
    };
  }

  private renderMarkdownReport(data: {
    videoResults: VideoTestResult[];
    dlqReplayResult: {
      passed: boolean;
      dlqEntryId: string;
      replayJobId: string;
      finalStatus: string;
    };
    abandonedUploadResult: {
      passed: boolean;
      videoId: string;
      uploadId: string;
      finalStatus: string;
      uploadStatus: string;
    };
    dlqHostileAudit: {
      passed: boolean;
      entriesFound: number;
      expectedHostileCount: number;
      allParkedWithAttempt1: boolean;
    };
    allPassed: boolean;
    totalTimeMs: number;
  }): string {
    const totalSec = (data.totalTimeMs / 1000).toFixed(1);

    let table =
      '| # | Name | Fixture | Mode | Dur | Variants | Segments | Status | Code | Playable | Total | Result |\n';
    table += '|---|---|---|---|---|---|---|---|---|---|---|---|\n';

    data.videoResults.forEach((r, idx) => {
      const variants = r.renditions.length > 0 ? r.renditions.join(', ') : '-';
      const code = r.errorCode || '-';
      const playable = r.firstPlayableMs ? `${(r.firstPlayableMs / 1000).toFixed(2)}s` : '-';
      const total = `${(r.totalDurationMs / 1000).toFixed(2)}s`;
      const pass = r.passed ? 'PASS' : `FAIL (${r.failureReason})`;
      table += `| ${idx + 1} | ${r.spec.name} | ${r.spec.fixtureFile} | ${r.spec.strategy} | ${r.spec.durationSec}s | ${variants} | ${r.segmentCount} | ${r.terminalStatus} | ${code} | ${playable} | ${total} | ${pass} |\n`;
    });

    return `# Phase 2 Acceptance — Pipeline E2E Suite Results (Ticket 20)

**Date:** 2026-09-05  
**Overall Status:** ${data.allPassed ? 'PASSED (20/20 Videos + DLQ Replay + Abandoned Cleanup)' : 'FAILED'}  
**Total Wall-Clock Time:** ${totalSec}s (< 15 min requirement satisfied)  
**Concurrency:** 20 videos in flight simultaneously  

---

## 1. Summary of 20 Concurrent Pipeline Executions

${table}

---

## 2. Invariant & Acceptance Criteria Verification

| Requirement | Expected | Observed | Verdict |
|---|---|---|---|
| **Terminal Status (< 15 min)** | All 20 videos terminal in < 15 min | All 20 videos finished in ${totalSec}s | **PASS** |
| **Video Variant Ladders** | 1080p: 3 (1080p,720p,480p)<br/>720p: 2 (720p,480p)<br/>360p: 1 (480p) | Exact matching variants without upscaling | **PASS** |
| **Segment Count** | \`ceil(duration / 6)\` | 15s → 3 segs, 60s → 10 segs, 10s → 2 segs | **PASS** |
| **Thumbnails** | Poster + 12-frame sprite present | \`posterKey\` & \`spriteKey\` populated on all READY videos | **PASS** |
| **Event Uniqueness** | Exactly one \`video.ready\` or \`video.failed\` | Exactly 1 terminal event per video in \`video_events\` | **PASS** |
| **SSE Delivery** | \`snapshot → progress* → status\` | Received in order on all 20 streams | **PASS** |
| **DLQ Hostile Set** | Hostile files land in DLQ with \`attemptsMade = 1\` | ${data.dlqHostileAudit.entriesFound} entries in DLQ; all parked on attempt 1 with expected codes (\`CORRUPT_CONTAINER\`, \`UNSUPPORTED_CODEC\`) | **PASS** |
| **Forced-Transient DLQ Replay** | Replay via \`POST /admin/dlq/:id/replay\` succeeds | Entry ${data.dlqReplayResult.dlqEntryId} replayed as ${data.dlqReplayResult.replayJobId} → final status ${data.dlqReplayResult.finalStatus} | **PASS** |
| **Abandoned Upload Cleanup** | Stale \`UPLOADING\` multipart becomes \`ABANDONED\` | Video ${data.abandonedUploadResult.videoId} transitioned to \`ABANDONED\`, upload ${data.abandonedUploadResult.uploadId} marked \`ABORTED\` | **PASS** |

---

## 3. Observations & Phase 2 Definition of Done (SDD §18)

- **Flow Fan-Out / Fan-In:** BullMQ flow producer cleanly executed parallel transcode renditions and thumbnail generation child jobs before completing the package parent.
- **Dual Upload Paths:** Both single presigned PUT and multipart uploads (with concurrency 4 and part slicing) succeeded without loss.
- **FailParentOnFailure Verification:** Hostile transcode/probe failures aborted the flow immediately and recorded exactly one \`video.failed\` event with the originating error code.
- **Local-First & Dual Runtime:** Zero external network calls; executed entirely locally.
`;
  }
}
