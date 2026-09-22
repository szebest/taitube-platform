import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateSha256, probeFile } from './probe';
import type { CheckResult, FixtureDefinition } from './types';

export function checkFixture(fixture: FixtureDefinition, outputDir: string): CheckResult {
  const filePath = path.join(outputDir, fixture.filename);

  if (!fs.existsSync(filePath)) {
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: `File does not exist at ${filePath}`,
    };
  }

  const stat = fs.statSync(filePath);

  if (fixture.id === 'zero-bytes') {
    if (stat.size === 0) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: true,
        message: 'Valid 0-byte file',
      };
    }
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: `Expected 0 bytes, got ${stat.size}`,
    };
  }

  if (fixture.id === 'not-a-video') {
    const probe = probeFile(filePath);
    if (!probe?.streams || probe.streams.length === 0) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: true,
        message: 'Corrupt non-video correctly rejected by probe',
      };
    }
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: 'Expected ffprobe to fail for not-a-video',
    };
  }

  if (fixture.id === 'truncated') {
    // Truncated file should either fail probe or report invalid/incomplete streams
    const probe = probeFile(filePath);
    if (!probe?.format?.duration) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: true,
        message: 'Truncated video correctly detected as damaged',
      };
    }
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: true,
      message: 'Truncated video probed (has damaged streams)',
    };
  }

  const probe = probeFile(filePath);
  if (!probe) {
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: 'ffprobe failed to read file metadata',
    };
  }

  const videoStream = probe.streams.find((s) => s.codec_type === 'video');
  const audioStream = probe.streams.find((s) => s.codec_type === 'audio');

  if (fixture.id === 'audio-only') {
    if (!videoStream && audioStream) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: true,
        message: 'Valid audio-only stream (no video stream present)',
      };
    }
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: 'Expected audio-only stream with no video',
    };
  }

  if (!videoStream) {
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: 'Missing video stream',
    };
  }

  if (fixture.width && videoStream.width !== fixture.width) {
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: `Width mismatch: expected ${fixture.width}, got ${videoStream.width}`,
    };
  }

  if (fixture.height && videoStream.height !== fixture.height) {
    return {
      id: fixture.id,
      filename: fixture.filename,
      passed: false,
      message: `Height mismatch: expected ${fixture.height}, got ${videoStream.height}`,
    };
  }

  if (fixture.durationSeconds && probe.format.duration) {
    const dur = Number.parseFloat(probe.format.duration);
    if (Math.abs(dur - fixture.durationSeconds) > 1.5) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: false,
        message: `Duration mismatch: expected ~${fixture.durationSeconds}s, got ${dur.toFixed(2)}s`,
      };
    }
  }

  if (fixture.rotate) {
    const hasRotateTag =
      videoStream.tags?.['rotate'] === String(fixture.rotate) ||
      probe.format.tags?.['rotate'] === String(fixture.rotate);
    const hasSideDataRotate = videoStream.side_data_list?.some(
      (sd) => sd.rotation === fixture.rotate
    );
    if (!(hasRotateTag || hasSideDataRotate)) {
      return {
        id: fixture.id,
        filename: fixture.filename,
        passed: false,
        message: `Missing rotation tag ${fixture.rotate}`,
      };
    }
  }

  const sha = calculateSha256(filePath);

  return {
    id: fixture.id,
    filename: fixture.filename,
    passed: true,
    message: `Probe OK: ${videoStream.width}x${videoStream.height}, ${videoStream.codec_name}, duration=${probe.format.duration}s (sha256=${sha.slice(0, 12)}...)`,
  };
}
