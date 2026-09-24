import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { mediaTools } from '@vp/ffmpeg';
import { LogContext, createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { expectOk } from '@vp/testing/result';
import { composeApp } from '../../apps/api/src/app';
import { composeWorker } from '../../apps/worker/src/runner';

const OWNER_ID = '0190a000-0000-7000-8000-0000000000c1';
const RAW_BUCKET = 'raw';

describe('in-process: one request id from the API into the worker', () => {
  it('writes the id of POST /v1/uploads/:id/complete on the probe job log lines', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-correlation-'));
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    const probeQueue = new InMemoryJobQueue('probe');
    const config = inProcessAppConfig({
      buckets: { raw: RAW_BUCKET },
      worker: { stage: 'probe', tmpDir, heartbeatPath: path.join(tmpDir, 'heartbeat') },
    });

    const { app: api } = await composeApp({
      config,
      adapters: { repositories, storage, probeQueue },
    });
    const workerLog = captureLog();
    const logContext = new LogContext();
    const worker = await composeWorker({
      config,
      adapters: { repositories, storage, jobQueue: probeQueue },
      logger: createLogger({
        format: 'json',
        service: 'worker-probe',
        level: 'info',
        destination: workerLog.destination,
        context: logContext,
      }),
      logContext,
      media: mediaTools,
      workerId: 'correlation-spec',
    });
    expectOk(await worker.start());

    const authorization = `Bearer ${mintToken({ sub: OWNER_ID, role: 'user', ttl: '1h' })}`;
    const started = await api.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization },
      payload: { filename: 'a.mp4', sizeBytes: 1024, contentType: 'video/mp4', title: 'a' },
    });
    const { uploadId, videoId } = started.json<{ uploadId: string; videoId: string }>();
    const video = await repositories.videos.findById(videoId);
    await storage.uploadObject({
      bucket: RAW_BUCKET,
      key: video.ok && video.value ? video.value.sourceKey : '',
      body: Buffer.alloc(1024, 0x55),
      contentType: 'video/mp4',
    });

    const completed = await api.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: { authorization, 'x-request-id': 'req-correlate-1' },
      payload: {},
    });
    await vi.waitFor(() => expect(probeQueue.failedJobs.length).toBeGreaterThan(0));

    expect(completed.statusCode).toBe(202);
    const probeLines = workerLog.lines().filter((line) => line.videoId === videoId);
    expect(probeLines.length).toBeGreaterThan(0);
    expect(probeLines.every((line) => line.requestId === 'req-correlate-1')).toBe(true);

    await worker.close();
    await api.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
