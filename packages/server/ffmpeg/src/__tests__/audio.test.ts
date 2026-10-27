import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { buildAudioArgs, runFfmpegAudio } from '../audio';

const S2 = path.resolve(__dirname, '../../../../../tests/fixtures/s2.mp4');
const LIMITS = { killGraceMs: 1000, stderrTailLines: 20 };

function streamOf(file: string): string {
  return execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,sample_rate,channels',
      '-of',
      'csv=p=0',
      file,
    ],
    { encoding: 'utf-8' }
  ).trim();
}

describe('@vp/ffmpeg: audio for speech-to-text', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-audio-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('seeks before the input so a window range-reads its slice', () => {
    const args = buildAudioArgs({
      sourcePath: 'https://s3/x',
      outputPath: 'a.wav',
      startMs: 175_000,
      durationMs: 190_000,
    });

    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 4)).toEqual([
      '-ss',
      '175',
      '-t',
      '190',
    ]);
  });

  it('writes the window as mono 16 kHz PCM', async () => {
    const outputPath = path.join(dir, 'audio.wav');

    await runFfmpegAudio({
      ffmpegPath: 'ffmpeg',
      limits: LIMITS,
      timeoutMs: 30_000,
      sourcePath: S2,
      outputPath,
      startMs: 500,
      durationMs: 1000,
    });

    expect(streamOf(outputPath)).toBe('pcm_s16le,16000,1');
  });

  it('rejects a source with no audio stream as permanent', async () => {
    const silent = path.join(dir, 'video-only.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-i', S2, '-an', '-c:v', 'copy', silent]);

    await expect(
      runFfmpegAudio({
        ffmpegPath: 'ffmpeg',
        limits: LIMITS,
        timeoutMs: 30_000,
        sourcePath: silent,
        outputPath: path.join(dir, 'audio.wav'),
        startMs: 0,
        durationMs: 1000,
      })
    ).rejects.toMatchObject({ code: ErrorCodes.NO_AUDIO_STREAM });
  });
});
