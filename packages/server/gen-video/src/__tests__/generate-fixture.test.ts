import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateFixture } from '../generate-fixture';
import { probeFile } from '../probe';
import type { FixtureDefinition } from '../types';

const ZERO_BYTES: FixtureDefinition = {
  id: 'zero-bytes',
  filename: 'zero.mp4',
  description: 'empty file',
  category: 'hostile',
  slow: false,
};

function generated(fixture: FixtureDefinition, outputDir: string): string {
  const outcome = generateFixture(fixture, outputDir);
  if (outcome.type === 'failed') throw new Error(outcome.reason);
  return outcome.path;
}

describe('gen-video: fixture generation', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-generate-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a zero-byte fixture without invoking ffmpeg', () => {
    const file = generated(ZERO_BYTES, tmpDir);

    expect(fs.statSync(file).size).toBe(0);
  });

  it('writes text that is not a container for not-a-video', () => {
    const file = generated({ ...ZERO_BYTES, id: 'not-a-video', filename: 'text.mp4' }, tmpDir);

    expect(fs.readFileSync(file, 'utf8')).toContain('NOT_A_VALID_VIDEO');
  });

  it('creates the output directory when it does not exist', () => {
    const nested = path.join(tmpDir, 'nested', 'deeper');

    generated(ZERO_BYTES, nested);

    expect(fs.existsSync(nested)).toBe(true);
  });

  it.each<{ fixture: FixtureDefinition; codec: string; audio: string | undefined }>([
    {
      fixture: {
        id: 'sd360',
        filename: 'sd360.mp4',
        description: 'standard',
        category: 'standard',
        slow: false,
        durationSeconds: 1,
        width: 640,
        height: 360,
      },
      codec: 'h264',
      audio: 'aac',
    },
    {
      fixture: {
        id: 'bad-codec',
        filename: 'bad-codec.mov',
        description: 'outside the allowlist',
        category: 'hostile',
        slow: false,
        durationSeconds: 1,
        width: 320,
        height: 240,
      },
      codec: 'mjpeg',
      audio: undefined,
    },
  ])('encodes $fixture.id as $codec at its declared size', ({ fixture, codec, audio }) => {
    const probe = probeFile(generated(fixture, tmpDir));
    const video = probe?.streams.find((stream) => stream.codec_type === 'video');
    const sound = probe?.streams.find((stream) => stream.codec_type === 'audio');

    expect(video).toMatchObject({
      codec_name: codec,
      width: fixture.width,
      height: fixture.height,
    });
    expect(sound?.codec_name).toBe(audio);
  });
});
