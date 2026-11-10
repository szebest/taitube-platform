import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InMemoryFrameClassifier,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { fingerprintTools } from '@vp/fingerprint';
import { createLogger } from '@vp/logger';
import { SEEDED, createMockJob } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../../__tests__/stage-settings';
import { createScreenProcessor } from '../../screen-stage';

const OTHER_OWNER = '00000000-0000-7000-8000-0000000000aa';
const SECONDS = 40;
const ORIGINAL_AUDIO =
  'aevalsrc=0.4*sin(2*PI*t*(300+200*sin(2*PI*t/7)))+0.3*sin(2*PI*t*(90+60*sin(2*PI*t/3.1))):s=44100';
const UNRELATED_AUDIO = 'anoisesrc=c=brown:seed=7:a=0.3:sample_rate=44100';

function ffmpeg(...args: string[]): void {
  execFileSync(STAGE_SETTINGS.ffmpegPath, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

/**
 * Needs ffmpeg and fpcalc on the PATH. Builds a clip, a re-encode at another size and bitrate, a copy
 * with its first fifth cut off, a mirror, a clip of which 35 percent is the original and an unrelated clip, and runs the real
 * stage over each against the clip as another channel uploaded it.
 */
describe('screen stage over the real ffmpeg and fpcalc', () => {
  const logger = createLogger({ format: 'json', service: 'screen-real', level: 'silent' });
  let dir: string;
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'vp-screen-real-'));
    const source = [
      '-f',
      'lavfi',
      '-i',
      'gradients=size=320x180:rate=25:speed=0.05:nb_colors=6:seed=3',
    ];
    ffmpeg(
      ...source,
      '-f',
      'lavfi',
      '-i',
      ORIGINAL_AUDIO,
      '-t',
      String(SECONDS),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '50',
      '-c:a',
      'aac',
      join(dir, 'original.mp4')
    );
    ffmpeg(
      '-i',
      join(dir, 'original.mp4'),
      '-vf',
      'scale=240:136',
      '-b:v',
      '200k',
      '-b:a',
      '64k',
      '-preset',
      'ultrafast',
      join(dir, 'reencoded.mp4')
    );
    ffmpeg(
      '-ss',
      String(SECONDS / 5),
      '-i',
      join(dir, 'original.mp4'),
      '-preset',
      'ultrafast',
      join(dir, 'trimmed.mp4')
    );
    ffmpeg(
      '-i',
      join(dir, 'original.mp4'),
      '-vf',
      'hflip',
      '-preset',
      'ultrafast',
      join(dir, 'mirrored.mp4')
    );
    ffmpeg(
      '-f',
      'lavfi',
      '-i',
      'gradients=size=320x180:rate=25:speed=0.03:nb_colors=4',
      '-f',
      'lavfi',
      '-i',
      UNRELATED_AUDIO,
      '-t',
      String(SECONDS),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      join(dir, 'unrelated.mp4')
    );
    const copied = SECONDS * 0.35;
    ffmpeg(
      '-i',
      join(dir, 'original.mp4'),
      '-i',
      join(dir, 'unrelated.mp4'),
      '-filter_complex',
      `[0:v]trim=0:${copied},setpts=PTS-STARTPTS[v0];[1:v]trim=0:${SECONDS - copied},setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1[v];[0:a]atrim=0:${copied},asetpts=PTS-STARTPTS[a0];[1:a]atrim=0:${SECONDS - copied},asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[a]`,
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      join(dir, 'excerpt.mp4')
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  async function screen(file: string, ownerId: string) {
    const videoId = uuidv7();
    const sourceKey = `raw/${videoId}/source.mp4`;
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId,
        title: file,
        status: 'PROCESSING',
        sourceKey,
        durationMs: SECONDS * 1000,
      })
    );
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: sourceKey,
        body: readFileSync(join(dir, file)),
        contentType: 'video/mp4',
      })
    );
    const processor = createScreenProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      fingerprint: fingerprintTools,
      classifier: new InMemoryFrameClassifier({ inputSize: 64 }),
      fpcalcPath: process.env.FPCALC_PATH ?? 'fpcalc',
    });
    const result = expectOk(
      await processor(
        createMockJob(
          'screen',
          {
            videoId,
            sourceKey,
            generation: 1,
            durationMs: SECONDS * 1000,
            hasAudio: true,
            traceparent: '00-01',
          },
          { id: `${videoId}--screen--g1` }
        )
      )
    );
    const stored = expectOk(await repositories.screenings.latestForVideo(videoId));
    return { result, stored, videoId };
  }

  it('holds a re-encode, a trimmed copy and a mirror of another channel video, and passes the rest', async () => {
    const original = await screen('original.mp4', OTHER_OWNER);
    expect(original.result.outcome).toBe('PASS');

    const outcomes: Record<
      string,
      { outcome: string; reasons: string[]; flags: string[] | undefined; match: unknown }
    > = {};
    for (const file of [
      'reencoded.mp4',
      'trimmed.mp4',
      'mirrored.mp4',
      'unrelated.mp4',
      'excerpt.mp4',
    ]) {
      const { result, stored } = await screen(file, SEEDED.userId);
      outcomes[file] = {
        outcome: result.outcome,
        reasons: result.reasons,
        flags: stored?.flags.map((flag) => `${flag.reason}:${flag.score.toFixed(2)}`),
        match: stored?.reasons[0]?.evidence,
      };
    }
    expect(outcomes['reencoded.mp4']).toMatchObject({ outcome: 'HOLD', reasons: ['DUPLICATE'] });
    expect(outcomes['trimmed.mp4']).toMatchObject({ outcome: 'HOLD', reasons: ['DUPLICATE'] });
    expect(outcomes['mirrored.mp4']).toMatchObject({ outcome: 'HOLD', reasons: ['DUPLICATE'] });
    expect(outcomes['excerpt.mp4']).toMatchObject({ outcome: 'PASS', reasons: [] });
    expect(String(outcomes['excerpt.mp4']?.flags)).toContain('PARTIAL_MATCH');
    expect(outcomes['unrelated.mp4']).toMatchObject({ outcome: 'PASS', flags: [] });
  });

  it('flags, and does not hold, a re-upload by the same channel', async () => {
    await screen('original.mp4', SEEDED.userId);

    const again = await screen('reencoded.mp4', SEEDED.userId);

    expect(again.result.outcome).toBe('PASS');
    expect(again.stored?.flags[0]).toMatchObject({
      reason: 'DUPLICATE',
      evidence: { sameChannel: true },
    });
  });
});
