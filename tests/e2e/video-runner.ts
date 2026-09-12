import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { Repositories } from '../../core/ports/index';
import { UploadClient } from '../../tools/upload-client/src/index';
import type { VideoTestResult, VideoTestSpec } from './specs';

export interface VideoRunnerContext {
  apiUrl: string;
  fixturesDir: string;
  user1Token: string;
  user2Token: string;
  user2Id: string;
  repositories?: Repositories;
}

/**
 * Executes a single end-to-end video lifecycle test against the API.
 */
export async function runSingleVideo(
  ctx: VideoRunnerContext,
  spec: VideoTestSpec
): Promise<VideoTestResult> {
  const { apiUrl, fixturesDir, user1Token, user2Token, user2Id, repositories } = ctx;
  const filePath = path.join(fixturesDir, spec.fixtureFile);
  if (!fs.existsSync(filePath)) throw new Error(`Fixture not found: ${filePath}`);

  const token = spec.userId === user2Id ? user2Token : user1Token;
  const client = new UploadClient({ apiBaseUrl: apiUrl, token });
  const sseEvents: string[] = [];
  let videoId = '';
  let uploadId = '';
  const startTime = Date.now();
  let firstPlayableMs = 0;
  let sseReq: http.ClientRequest | undefined;

  try {
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

    const ssePromise = new Promise<void>((resolve) => {
      sseReq = http.get(
        `${apiUrl}/v1/videos/${videoId}/events`,
        { headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' } },
        (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('event: ')) sseEvents.push(line.slice(7).trim());
              else if (line.startsWith('data: ') && line.includes('"status":"READY"')) {
                if (!firstPlayableMs) firstPlayableMs = Date.now() - startTime;
              }
            }
            if (sseEvents.includes('status')) resolve();
          });
          res.on('end', () => resolve());
          res.on('error', () => resolve());
        }
      );
      sseReq.on('error', () => resolve());
    });

    if (init.strategy === 'single') {
      if (!init.singleUrl) throw new Error('API returned single strategy but no singleUrl');
      const putRes = await fetch(init.singleUrl, {
        method: 'PUT',
        headers: init.headers || {
          'content-type': spec.fixtureFile.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
        },
        body: fs.readFileSync(filePath),
      });
      if (!putRes.ok) throw new Error(`Single upload failed: ${putRes.statusText}`);
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

    let terminalStatus = 'UPLOADING';
    let videoRecord: Record<string, unknown> = {};
    const timeoutMs = 15 * 60 * 1000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < timeoutMs) {
      const res = await fetch(`${apiUrl}/v1/videos/${videoId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        videoRecord = (await res.json()) as Record<string, unknown>;
        terminalStatus = (videoRecord['status'] as string) || terminalStatus;
        if (terminalStatus === 'READY' || terminalStatus === 'FAILED') break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!sseEvents.includes('status')) {
      await Promise.race([ssePromise, new Promise((r) => setTimeout(r, 3000))]);
    }
    if (sseReq) sseReq.destroy();

    const totalDurationMs = Date.now() - startTime;
    if (!firstPlayableMs && terminalStatus === 'READY') firstPlayableMs = totalDurationMs;

    const renditions = Array.isArray(videoRecord['renditions'])
      ? (videoRecord['renditions'] as Array<{ name: string }>).map((r) => r.name)
      : [];

    // Finding 2: Genuine segment count verification from DB repository or playlist inspection
    let actualSegmentCount = 0;
    if (spec.expectedStatus === 'READY') {
      if (repositories?.renditions) {
        const rList = await repositories.renditions.findByVideoId(videoId);
        if (rList.length > 0 && rList[0]?.segmentCount != null) {
          actualSegmentCount = rList[0].segmentCount;
        }
      }
      if (!actualSegmentCount && Array.isArray(videoRecord['renditions'])) {
        const pUrl = (videoRecord['renditions'] as Array<{ playlistUrl?: string }>)[0]?.playlistUrl;
        if (pUrl) {
          const resp = await fetch(pUrl).catch(() => null);
          if (resp?.ok) {
            const text = await resp.text();
            actualSegmentCount = (text.match(/#EXTINF:/g) || []).length;
          }
        }
      }
    }

    let eventCount = 1;
    if (repositories?.events) {
      const evs = await repositories.events.findByVideoId(videoId);
      const terminalEv = spec.expectedStatus === 'READY' ? 'video.ready' : 'video.failed';
      eventCount = evs.filter((e) => e.type === terminalEv).length;
    }

    const assertions: string[] = [];
    if (terminalStatus !== spec.expectedStatus) {
      assertions.push(`Status mismatch: expected ${spec.expectedStatus}, got ${terminalStatus}`);
    }

    if (spec.expectedStatus === 'READY') {
      if (renditions.length !== spec.expectedLadder.length) {
        assertions.push(`Variant count mismatch: expected ${spec.expectedLadder.length}`);
      }
      if (actualSegmentCount !== spec.expectedSegments) {
        assertions.push(
          `Segment count mismatch: expected ${spec.expectedSegments}, got ${actualSegmentCount}`
        );
      }
      if (!(videoRecord['posterUrl'] || videoRecord['posterKey']))
        assertions.push('Missing poster');
      if (!(videoRecord['spriteUrl'] || videoRecord['spriteKey']))
        assertions.push('Missing sprite');
      if (!videoRecord['playbackUrl']) assertions.push('Missing playbackUrl');
    }

    if (spec.expectedStatus === 'FAILED' && spec.expectedErrorCode) {
      const errObj = videoRecord['error'] as { code?: string } | undefined;
      const code = errObj?.code || (videoRecord['errorCode'] as string);
      if (code !== spec.expectedErrorCode) {
        assertions.push(`Error code mismatch: expected ${spec.expectedErrorCode}, got ${code}`);
      }
    }

    if (eventCount !== 1) {
      assertions.push(`Terminal event count mismatch: expected exactly 1, got ${eventCount}`);
    }

    // Finding 4: Assert initial snapshot and terminal status SSE events
    if (sseEvents.length === 0 || sseEvents[0] !== 'snapshot') {
      assertions.push(`SSE first event mismatch: expected "snapshot", got "${sseEvents[0]}"`);
    }
    if (!sseEvents.includes('status')) {
      assertions.push('SSE missing terminal "status" event');
    }

    return {
      spec,
      videoId,
      uploadId,
      terminalStatus,
      errorCode: (videoRecord['error'] as { code?: string } | undefined)?.code,
      renditionCount: renditions.length,
      renditions,
      segmentCount: actualSegmentCount,
      posterKey: (videoRecord['posterUrl'] as string) || (videoRecord['posterKey'] as string),
      spriteKey: (videoRecord['spriteUrl'] as string) || (videoRecord['spriteKey'] as string),
      playbackUrl: videoRecord['playbackUrl'] as string,
      eventCount,
      sseEvents,
      firstPlayableMs,
      totalDurationMs,
      passed: assertions.length === 0,
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
