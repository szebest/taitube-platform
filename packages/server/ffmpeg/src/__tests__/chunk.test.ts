import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { runFfmpegChunk, runFfmpegConcat } from '../chunk';
import { ENCODER } from './encoder-settings';

const S2 = path.resolve(__dirname, '../../../../../tests/fixtures/s2.mp4');
const rendition = CANONICAL_LADDER[2];

function packetTimeline(
  playlist: string,
  stream: 'v' | 'a'
): { start: number; end: number; ascending: boolean } {
  const probed = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      stream,
      '-show_entries',
      'packet=pts_time,duration_time',
      '-of',
      'csv=p=0',
      playlist,
    ],
    { encoding: 'utf-8' }
  );
  const packets = probed
    .trim()
    .split('\n')
    .map((line) => line.split(',').map(Number) as [number, number]);
  const ends = packets.map(([pts, duration]) => pts + duration);
  return {
    start: Math.min(...packets.map(([pts]) => pts)),
    end: Math.max(...ends),
    ascending: packets.every(
      ([pts], index) => index === 0 || pts >= (packets[index - 1]?.[0] ?? 0)
    ),
  };
}

describe('@vp/ffmpeg: chunked transcode', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-chunk-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('joins re-encoded chunks and the source audio into one rendition as long as the source', async () => {
    const chunks = [0, 1].map((index) => path.join(dir, `chunk_${index}.mp4`));
    for (const [index, outputPath] of chunks.entries()) {
      await runFfmpegChunk({
        ...ENCODER,
        gopSeconds: 0.5,
        sourcePath: S2,
        outputPath,
        rendition,
        fps: 24,
        durationMs: 1000,
        threads: 0,
        preset: 'ultrafast',
        startSeconds: index,
        durationSeconds: 1,
      });
    }
    const listPath = path.join(dir, 'list.txt');
    fs.writeFileSync(listPath, chunks.map((chunk) => `file '${chunk}'`).join('\n'));
    const outputDir = path.join(dir, 'hls');
    fs.mkdirSync(outputDir);

    await runFfmpegConcat({
      ...ENCODER,
      hlsSegmentSeconds: 1,
      listPath,
      audioSourcePath: S2,
      outputDir,
      rendition,
      durationMs: 2000,
      threads: 0,
    });

    const playlist = path.join(outputDir, 'index.m3u8');
    const video = packetTimeline(playlist, 'v');
    const audio = packetTimeline(playlist, 'a');
    expect(video.end - video.start).toBeCloseTo(2, 1);
    expect(Math.abs(audio.end - video.end)).toBeLessThan(0.1);
    expect(Math.abs(audio.start - video.start)).toBeLessThan(0.1);
    expect([video.ascending, audio.ascending]).toEqual([true, true]);
  });
});
