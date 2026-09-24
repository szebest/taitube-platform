import * as fs from 'node:fs';
import * as path from 'node:path';
import { E2ERunner, type E2ESuiteResult } from './e2e-runner';

describe('Phase 2 Acceptance: Pipeline E2E Suite with Hostile Set', () => {
  let suiteResult: E2ESuiteResult;
  const resultsDir = path.resolve(process.cwd(), 'docs/load-tests/results/2026-09-05-e2e');

  const isReduced = process.env.FULL !== 'true';

  beforeAll(async () => {
    const runner = new E2ERunner({
      resultsDir,
      reduced: isReduced,
    });

    suiteResult = await runner.executeSuite();
  }, 900_000);

  it('finishes the whole suite in under 15 minutes', () => {
    expect(suiteResult.totalTimeMs).toBeLessThan(15 * 60 * 1000);
    expect(suiteResult.videoResults.length).toBe(isReduced ? 4 : 20);
  });

  it('brings every video to its expected terminal status', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.terminalStatus, `Video ${res.spec.name} status`).toBe(res.spec.expectedStatus);
      if (res.spec.expectedStatus === 'FAILED' && res.spec.expectedErrorCode) {
        expect(res.errorCode, `Video ${res.spec.name} error code`).toBe(res.spec.expectedErrorCode);
      }
    }
  });

  it('gives ready videos the expected variant count without upscaling', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(
        res.renditionCount,
        `Video ${res.spec.name} variant count (${res.renditions.join(',')})`
      ).toBe(res.spec.expectedLadder.length);
    }
  });

  it('cuts ceil(duration / 6) segments per ready video', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(res.segmentCount).toBe(Math.ceil(res.spec.durationSec / 6));
    }
  });

  it('gives every ready video a poster, sprite and playback URL', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(res.posterKey, `Video ${res.spec.name} posterKey`).toBeDefined();
      expect(res.spriteKey, `Video ${res.spec.name} spriteKey`).toBeDefined();
      expect(res.playbackUrl, `Video ${res.spec.name} playbackUrl`).toBeDefined();
    }
  });

  it('emits exactly one video.ready or video.failed event per video', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.eventCount, `Video ${res.spec.name} event count`).toBe(1);
    }
  });

  it('streams a snapshot first and then a terminal status event over SSE', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.sseEvents, `Video ${res.spec.name} SSE events`).toContain('snapshot');
      expect(res.sseEvents[0]).toBe('snapshot');
      expect(res.sseEvents, `Video ${res.spec.name} SSE status`).toContain('status');
    }
  });

  it('parks hostile files in the DLQ on attempt 1 with the expected error codes', () => {
    expect(suiteResult.dlqHostileAudit.passed).toBe(true);
    expect(suiteResult.dlqHostileAudit.allParkedWithAttempt1).toBe(true);
  });

  it('replays a forced-transient DLQ entry through the admin endpoint', () => {
    expect(suiteResult.dlqReplayResult.passed).toBe(true);
    expect(suiteResult.dlqReplayResult.finalStatus).toBe('REPLAYED');
    expect(suiteResult.dlqReplayResult.replayJobId).toMatch(/--r\d+$/);
  });

  it('moves a deliberately abandoned multipart upload to ABANDONED', () => {
    expect(suiteResult.abandonedUploadResult.passed).toBe(true);
    expect(suiteResult.abandonedUploadResult.finalStatus).toBe('ABANDONED');
    expect(suiteResult.abandonedUploadResult.uploadStatus).toBe('ABORTED');
  });

  it('writes the markdown results report with the summary table and metrics', () => {
    const reportFile = path.join(resultsDir, 'README.md');
    expect(fs.existsSync(reportFile)).toBe(true);
    const content = fs.readFileSync(reportFile, 'utf-8');
    expect(content).toContain('Phase 2 Acceptance');
    expect(content).toContain('s15-single');
    if (!isReduced) {
      expect(content).toContain('s60-multi');
    }
    expect(content).toContain('hostile-truncated');
    expect(content).toContain('hostile-bad-codec');
  });
});
