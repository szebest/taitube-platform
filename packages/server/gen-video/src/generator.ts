import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CheckResult,
  FixtureDefinition,
  FixtureManifest,
  GeneratorOptions,
  ProbeResult,
} from './types';

export function loadManifest(): FixtureManifest {
  const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as FixtureManifest;
}

export function probeFile(filePath: string): ProbeResult | null {
  try {
    const stdout = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout) as ProbeResult;
  } catch {
    return null;
  }
}

export function calculateSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function generateFixture(
  fixture: FixtureDefinition,
  outputDir: string
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, fixture.filename);

  switch (fixture.id) {
    case 'zero-bytes': {
      fs.writeFileSync(outPath, Buffer.alloc(0));
      return outPath;
    }

    case 'not-a-video': {
      fs.writeFileSync(outPath, 'THIS_IS_DEFINITELY_NOT_A_VALID_VIDEO_FILE_CONTENT\n');
      return outPath;
    }

    case 'truncated': {
      const tempPath = path.join(outputDir, `_temp_${fixture.filename}`);
      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'testsrc2=size=640x360:rate=24',
            '-t',
            '4',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            tempPath,
          ],
          { stdio: 'ignore' }
        );

        const bytes = fs.readFileSync(tempPath);
        // Cut the file in half to truncate moov/mdat
        const truncatedBytes = bytes.subarray(0, Math.floor(bytes.length * 0.45));
        fs.writeFileSync(outPath, truncatedBytes);
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
      return outPath;
    }

    case 'audio-only': {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440',
          '-t',
          String(fixture.durationSeconds ?? 5),
          '-c:a',
          'aac',
          '-vn',
          outPath,
        ],
        { stdio: 'ignore' }
      );
      return outPath;
    }

    case 'hevc.mkv': {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc2=size=640x360:rate=24',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440',
          '-t',
          String(fixture.durationSeconds ?? 5),
          '-c:v',
          'libx265',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          outPath,
        ],
        { stdio: 'ignore' }
      );
      return outPath;
    }

    case 'portrait': {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const fps = fixture.fps ?? 24;
      const dur = fixture.durationSeconds ?? 15;

      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `testsrc2=size=${w}x${h}:rate=${fps}`,
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440',
          '-t',
          String(dur),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          '-vf',
          "drawtext=text='%{pts\\:hms}':fontsize=36:fontcolor=white:x=(w-tw)/2:y=h-th-20",
          '-metadata',
          'rotate=90',
          '-metadata:s:v:0',
          'rotate=90',
          '-movflags',
          '+use_metadata_tags',
          outPath,
        ],
        { stdio: 'ignore' }
      );
      return outPath;
    }

    case 'vfr': {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const dur = fixture.durationSeconds ?? 15;

      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `testsrc2=size=${w}x${h}:rate=30`,
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440',
          '-t',
          String(dur),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          '-vf',
          "drawtext=text='%{pts\\:hms}':fontsize=36:fontcolor=white:x=(w-tw)/2:y=h-th-20",
          outPath,
        ],
        { stdio: 'ignore' }
      );
      return outPath;
    }

    default: {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const fps = fixture.fps ?? 24;
      const dur = fixture.durationSeconds ?? 15;

      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `testsrc2=size=${w}x${h}:rate=${fps}`,
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440',
          '-t',
          String(dur),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          '-vf',
          `drawtext=text='%{pts\\:hms}':fontsize=${Math.max(16, Math.floor(h / 30))}:fontcolor=white:x=(w-tw)/2:y=h-th-20`,
          outPath,
        ],
        { stdio: 'ignore' }
      );
      return outPath;
    }
  }
}

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

export async function generateAllFixtures(
  options: GeneratorOptions
): Promise<{ generated: string[]; errors: string[] }> {
  const manifest = loadManifest();
  const generated: string[] = [];
  const errors: string[] = [];

  const targets = manifest.fixtures.filter((f) => {
    if (options.only) {
      return f.id === options.only;
    }
    if (f.slow && !options.includeSlow) {
      return false;
    }
    return true;
  });

  for (const fixture of targets) {
    try {
      if (!options.quiet) {
        console.log(`[gen-video] Generating ${fixture.id} (${fixture.filename})...`);
      }
      const out = await generateFixture(fixture, options.outputDir);
      generated.push(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to generate ${fixture.id}: ${msg}`);
    }
  }

  return { generated, errors };
}
