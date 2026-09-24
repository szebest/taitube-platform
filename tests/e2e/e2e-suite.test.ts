import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../../packages/server/logger/src/index';
import { E2ERunner, type E2ESuiteResult } from './e2e-runner';

describe('Phase 2 Acceptance: Pipeline E2E Suite with Hostile Set (Ticket 20)', () => {
  let suiteResult: E2ESuiteResult;
  const resultsDir = path.resolve(process.cwd(), 'docs/load-tests/results/2026-09-05-e2e');

  const isReduced = process.env.FULL !== 'true';

  beforeAll(async () => {
    const runner = new E2ERunner(
      { resultsDir, reduced: isReduced },
      createLogger({ service: 'e2e-suite', level: 'info', format: 'pretty' })
    );

    suiteResult = await runner.executeSuite();
  }, 900_000); // 15-minute suite timeout per ticket

  it('AC 1: Total execution time is under 15 minutes', () => {
    expect(suiteResult.totalTimeMs).toBeLessThan(15 * 60 * 1000);
    expect(suiteResult.videoResults.length).toBe(isReduced ? 4 : 20);
  });

  it('AC 2: All 20 videos reach expected terminal status', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.terminalStatus, `Video ${res.spec.name} status`).toBe(res.spec.expectedStatus);
      if (res.spec.expectedStatus === 'FAILED' && res.spec.expectedErrorCode) {
        expect(res.errorCode, `Video ${res.spec.name} error code`).toBe(res.spec.expectedErrorCode);
      }
    }
  });

  it('AC 2: Ready videos have expected variant count without upscaling', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(
        res.renditionCount,
        `Video ${res.spec.name} variant count (${res.renditions.join(',')})`
      ).toBe(res.spec.expectedLadder.length);
    }
  });

  it('AC 2: Segment count matches ceil(duration / 6)', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(res.segmentCount).toBe(Math.ceil(res.spec.durationSec / 6));
    }
  });

  it('AC 2: Poster and sprite are present on all READY videos', () => {
    const readyVideos = suiteResult.videoResults.filter((r) => r.spec.expectedStatus === 'READY');
    for (const res of readyVideos) {
      expect(res.posterKey, `Video ${res.spec.name} posterKey`).toBeDefined();
      expect(res.spriteKey, `Video ${res.spec.name} spriteKey`).toBeDefined();
      expect(res.playbackUrl, `Video ${res.spec.name} playbackUrl`).toBeDefined();
    }
  });

  it('AC 2: Exactly one video.ready or video.failed event per video', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.eventCount, `Video ${res.spec.name} event count`).toBe(1);
    }
  });

  it('AC 2: SSE stream received snapshot first and terminal status event', () => {
    for (const res of suiteResult.videoResults) {
      expect(res.sseEvents, `Video ${res.spec.name} SSE events`).toContain('snapshot');
      expect(res.sseEvents[0]).toBe('snapshot');
      expect(res.sseEvents, `Video ${res.spec.name} SSE status`).toContain('status');
    }
  });

  it('AC 3: DLQ contains hostile files parked on attempt 1 with expected error codes', () => {
    expect(suiteResult.dlqHostileAudit.passed).toBe(true);
    expect(suiteResult.dlqHostileAudit.allParkedWithAttempt1).toBe(true);
  });

  it('AC 3: Replaying a forced-transient DLQ entry succeeds via admin endpoint', () => {
    expect(suiteResult.dlqReplayResult.passed).toBe(true);
    expect(suiteResult.dlqReplayResult.finalStatus).toBe('REPLAYED');
    expect(suiteResult.dlqReplayResult.replayJobId).toMatch(/--r\d+$/);
  });

  it('AC 4: Deliberately abandoned multipart upload transitions to ABANDONED', () => {
    expect(suiteResult.abandonedUploadResult.passed).toBe(true);
    expect(suiteResult.abandonedUploadResult.finalStatus).toBe('ABANDONED');
    expect(suiteResult.abandonedUploadResult.uploadStatus).toBe('ABORTED');
  });

  it('AC 5: Markdown results report is written with summary table and metrics', () => {
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
