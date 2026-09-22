import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FixtureDefinition } from './types';

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
