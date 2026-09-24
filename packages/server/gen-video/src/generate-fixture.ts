import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FixtureDefinition } from './types';

export type FixtureOutcome =
  | { readonly type: 'generated'; readonly path: string }
  | { readonly type: 'failed'; readonly reason: string };

/** FFmpeg's own exit status, read rather than thrown: `undefined` when it wrote the file. */
function ffmpeg(args: string[]): FixtureOutcome | undefined {
  const run = spawnSync('ffmpeg', args, { stdio: 'ignore' });
  if (run.error) return { type: 'failed', reason: run.error.message };
  return run.status === 0 ? undefined : { type: 'failed', reason: `ffmpeg exited ${run.status}` };
}

export function generateFixture(fixture: FixtureDefinition, outputDir: string): FixtureOutcome {
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, fixture.filename);

  switch (fixture.id) {
    case 'zero-bytes': {
      fs.writeFileSync(outPath, Buffer.alloc(0));
      return { type: 'generated', path: outPath };
    }

    case 'not-a-video': {
      fs.writeFileSync(outPath, 'THIS_IS_DEFINITELY_NOT_A_VALID_VIDEO_FILE_CONTENT\n');
      return { type: 'generated', path: outPath };
    }

    case 'truncated': {
      const tempPath = path.join(outputDir, `_temp_${fixture.filename}`);
      try {
        const failed = ffmpeg([
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
        ]);
        if (failed) return failed;

        const bytes = fs.readFileSync(tempPath);
        const truncatedBytes = bytes.subarray(0, Math.floor(bytes.length * 0.45));
        fs.writeFileSync(outPath, truncatedBytes);
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
      return { type: 'generated', path: outPath };
    }

    case 'audio-only': {
      const failed = ffmpeg([
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
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }

    case 'hevc.mkv': {
      const failed = ffmpeg([
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
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }

    case 'bad-codec': {
      const failed = ffmpeg([
        '-y',
        '-f',
        'lavfi',
        '-i',
        `testsrc2=size=${fixture.width ?? 320}x${fixture.height ?? 240}:rate=24`,
        '-t',
        String(fixture.durationSeconds ?? 1),
        '-c:v',
        'mjpeg',
        outPath,
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }

    case 'portrait': {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const fps = fixture.fps ?? 24;
      const dur = fixture.durationSeconds ?? 15;

      const failed = ffmpeg([
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
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }

    case 'vfr': {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const dur = fixture.durationSeconds ?? 15;

      const failed = ffmpeg([
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
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }

    default: {
      const w = fixture.width ?? 1920;
      const h = fixture.height ?? 1080;
      const fps = fixture.fps ?? 24;
      const dur = fixture.durationSeconds ?? 15;

      const failed = ffmpeg([
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
      ]);
      if (failed) return failed;
      return { type: 'generated', path: outPath };
    }
  }
}
