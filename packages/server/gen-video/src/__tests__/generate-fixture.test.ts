import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateFixture } from '../generate-fixture';
import type { FixtureDefinition } from '../types';

describe('gen-video: fixture generation', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-generate-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a zero-byte fixture without invoking ffmpeg', async () => {
    const fixture: FixtureDefinition = {
      id: 'zero-bytes',
      filename: 'zero.mp4',
      description: 'empty file',
      category: 'hostile',
      slow: false,
    };

    const outcome = generateFixture(fixture, tmpDir);
    if (outcome.type !== 'generated') throw new Error(outcome.reason);
    const outPath = outcome.path;

    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBe(0);
  });

  it('creates the output directory when it does not exist', async () => {
    const nested = path.join(tmpDir, 'nested', 'deeper');
    const fixture: FixtureDefinition = {
      id: 'zero-bytes',
      filename: 'zero.mp4',
      description: 'empty file',
      category: 'hostile',
      slow: false,
    };

    expect(generateFixture(fixture, nested).type).toBe('generated');

    expect(fs.existsSync(nested)).toBe(true);
  });
});
