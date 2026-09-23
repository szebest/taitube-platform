import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runReconcileUploads } from '../../apps/worker/src/stages/housekeeping/reconcile-uploads';
import { InMemoryJobQueue } from '../../packages/server/adapters/in-memory/in-memory-job-queue';
import type {
  MultipartStorage,
  Repositories,
  StorageClient,
} from '../../packages/server/core/ports/index';
import { expectOk } from '../../packages/server/testing/src/result';
import { UploadClient } from '../../packages/server/upload-client/src/index';
import { ErrorCodes } from '../../packages/universal/errors/src/index';
import { unwrapOr } from '../../packages/universal/result/src/index';
import type { VideoTestResult, VideoTestSpec } from './specs';

const uuidv7 = () => crypto.randomUUID();

export interface DlqCheckContext {
  apiUrl: string;
  adminToken: string;
  user1Token: string;
  adminId: string;
  fixturesDir: string;
  repositories: Repositories;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  specs: VideoTestSpec[];
}

export async function runForcedTransientDlqReplay(ctx: DlqCheckContext): Promise<{
  passed: boolean;
  dlqEntryId: string;
  replayJobId: string;
  finalStatus: string;
}> {
  const { apiUrl, adminToken, adminId, fixturesDir, repositories, storage } = ctx;
  const s15Path = path.join(fixturesDir, 's15.mp4');
  if (fs.existsSync(s15Path) && storage) {
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/s15.mp4',
      body: fs.readFileSync(s15Path),
      contentType: 'video/mp4',
    });
  }

  const videoId = uuidv7();
  expectOk(
    await repositories.videos.create({
      id: videoId,
      ownerId: adminId,
      title: 'Forced Transient Replay Video',
      status: 'PROCESSING',
      sourceKey: 'raw/s15.mp4',
    })
  );

  const created = await repositories.dlq.create({
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
  const entry = expectOk(created);

  const replayRes = await fetch(`${apiUrl}/admin/dlq/${entry.id}/replay`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ force: true }),
  });
  if (replayRes.status !== 202) {
    throw new Error(`DLQ replay failed (${replayRes.status}): ${await replayRes.text()}`);
  }

  const replayData = (await replayRes.json()) as { status: string; replayJobId: string };
  const updated = unwrapOr(await repositories.dlq.findById(entry.id), null);

  const replayStart = Date.now();
  let replayedStepSuccess = false;
  while (Date.now() - replayStart < 30000) {
    const steps = unwrapOr(await repositories.steps.findByVideoId(videoId), []);
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

export async function runAbandonedUploadTest(ctx: DlqCheckContext): Promise<{
  passed: boolean;
  videoId: string;
  uploadId: string;
  finalStatus: string;
  uploadStatus: string;
}> {
  const { apiUrl, user1Token, repositories, multipart } = ctx;
  const client = new UploadClient({ apiBaseUrl: apiUrl, token: user1Token });
  const init = await client.initUpload({
    filename: 'abandoned-upload.mp4',
    sizeBytes: 32 * 1024 * 1024,
    contentType: 'video/mp4',
    strategy: 'multipart',
  });

  await new Promise((r) => setTimeout(r, 50));
  if (repositories && multipart) {
    await runReconcileUploads({
      rawBucket: 'raw',
      maxInflightPerUser: 3,
      repositories,
      multipart,
      probeQueue: new InMemoryJobQueue('probe'),
      uploadingThresholdMs: 10,
    });
  }

  const video = unwrapOr(await repositories.videos.findById(init.videoId), null);
  const upload = unwrapOr(await repositories.uploads.findById(init.uploadId), null);
  return {
    passed: Boolean(video?.status === 'ABANDONED' && upload?.status === 'ABORTED'),
    videoId: init.videoId,
    uploadId: init.uploadId,
    finalStatus: video?.status || 'UNKNOWN',
    uploadStatus: upload?.status || 'UNKNOWN',
  };
}

export async function auditDlqHostile(
  ctx: DlqCheckContext,
  videoResults?: VideoTestResult[]
): Promise<{
  passed: boolean;
  entriesFound: number;
  expectedHostileCount: number;
  allParkedWithAttempt1: boolean;
}> {
  const { apiUrl, adminToken, repositories, specs } = ctx;
  let items: Array<{
    id: string;
    videoId?: string | null;
    errorCode?: string | null;
    status: string;
    attemptsMade: number;
  }> = [];

  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/admin/dlq?limit=100`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { items: typeof items };
        items = body.items || [];
      }
    } catch {
      // Fallback to direct repo access
    }
  }

  if (items.length === 0 && repositories?.dlq) {
    items = unwrapOr(await repositories.dlq.list({ limit: 100 }), []);
  }

  const hostileSpecs = specs.filter((s) => s.expectedStatus === 'FAILED');
  let parkedAttempt1Count = 0;

  if (videoResults) {
    const hostileResults = videoResults.filter((r) => r.spec.expectedStatus === 'FAILED');
    for (const r of hostileResults) {
      const match = items.find(
        (entry) =>
          entry.videoId === r.videoId &&
          entry.errorCode === r.spec.expectedErrorCode &&
          entry.status === 'PARKED' &&
          entry.attemptsMade === 1
      );
      if (match) parkedAttempt1Count++;
    }
  } else {
    for (const spec of hostileSpecs) {
      const match = items.find(
        (entry) =>
          entry.errorCode === spec.expectedErrorCode &&
          entry.status === 'PARKED' &&
          entry.attemptsMade === 1
      );
      if (match) parkedAttempt1Count++;
    }
  }

  const passed = parkedAttempt1Count === hostileSpecs.length && hostileSpecs.length > 0;
  return {
    passed,
    entriesFound: items.length,
    expectedHostileCount: hostileSpecs.length,
    allParkedWithAttempt1: passed,
  };
}
