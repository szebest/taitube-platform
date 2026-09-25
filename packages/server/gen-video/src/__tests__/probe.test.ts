import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { calculateSha256, loadManifest, probeFile } from '../probe';

describe('gen-video: fixture manifest and probing', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-probe-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads a manifest whose every fixture declares an id and a filename', () => {
    const manifest = loadManifest();

    for (const fixture of manifest.fixtures) {
      expect(fixture.id).toBeTruthy();
      expect(fixture.filename).toBeTruthy();
    }
  });

  it('declares every fixture a spec or the e2e suite reads', () => {
    const ids = loadManifest().fixtures.map((fixture) => fixture.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        's2',
        's15',
        's60',
        'm10',
        'l30',
        'p720',
        'sd360',
        'portrait',
        'vfr',
        'k60',
        'truncated',
        'audio-only',
        'hevc.mkv',
        'bad-codec',
        'zero-bytes',
        'not-a-video',
        'over-duration',
      ])
    );
  });

  it('hashes a file deterministically', () => {
    const file = path.join(tmpDir, 'sample.bin');
    fs.writeFileSync(file, 'taitube');

    expect(calculateSha256(file)).toBe(calculateSha256(file));
    expect(calculateSha256(file)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null rather than throwing for a file ffprobe cannot read', () => {
    const file = path.join(tmpDir, 'not-a-video.mp4');
    fs.writeFileSync(file, 'definitely not a container');

    expect(probeFile(file)).toBeNull();
  });
});
