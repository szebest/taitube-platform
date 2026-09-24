import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkFixture } from '../check-fixture';
import { generateFixture } from '../generate-fixture';
import { loadManifest, probeFile } from '../probe';

describe('tools/gen-video: deterministic fixture generator', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-fixtures-test-'));
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('loads valid manifest with at least 15 fixtures', () => {
    const manifest = loadManifest();
    expect(manifest.version).toBeDefined();
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(15);
  });

  it.each([
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
    'zero-bytes',
    'not-a-video',
    'over-duration',
  ])('defines required fixture "%s" in manifest', (id) => {
    const manifest = loadManifest();
    const presentIds = manifest.fixtures.map((f) => f.id);
    expect(presentIds).toContain(id);
  });

  it('generates and checks zero-bytes hostile fixture', async () => {
    const manifest = loadManifest();
    const fixture = manifest.fixtures.find((f) => f.id === 'zero-bytes');
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = generateFixture(fixture, tmpDir);
    if (outcome.type !== 'generated') throw new Error(outcome.reason);
    const outPath = outcome.path;

    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBe(0);

    const result = checkFixture(fixture, tmpDir);
    expect(result.passed).toBe(true);
  });

  it('generates and checks not-a-video hostile fixture', async () => {
    const manifest = loadManifest();
    const fixture = manifest.fixtures.find((f) => f.id === 'not-a-video');
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = generateFixture(fixture, tmpDir);
    if (outcome.type !== 'generated') throw new Error(outcome.reason);
    const outPath = outcome.path;

    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBeGreaterThan(0);

    const result = checkFixture(fixture, tmpDir);
    expect(result.passed).toBe(true);
  });

  it('generates and probes standard test fixture', async () => {
    const manifest = loadManifest();
    const base = manifest.fixtures.find((f) => f.id === 'sd360');
    expect(base).toBeDefined();
    if (!base) return;

    const fixture = {
      ...base,
      durationSeconds: 2,
    };
    const outcome = generateFixture(fixture, tmpDir);
    if (outcome.type !== 'generated') throw new Error(outcome.reason);
    const outPath = outcome.path;

    expect(fs.existsSync(outPath)).toBe(true);
    const probe = probeFile(outPath);
    expect(probe).not.toBeNull();
    expect(
      probe?.streams.some((s) => s.codec_type === 'video' && s.width === 640 && s.height === 360)
    ).toBe(true);
    expect(probe?.streams.some((s) => s.codec_type === 'audio' && s.codec_name === 'aac')).toBe(
      true
    );
  });
});
