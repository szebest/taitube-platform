import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateAllFixtures, selectFixtures } from '../generator';
import type { FixtureManifest } from '../types';

const MANIFEST: FixtureManifest = {
  version: '1',
  description: 'spec manifest',
  fixtures: [
    { id: 'fast', filename: 'fast.mp4', description: '', category: 'standard', slow: false },
    { id: 'slow', filename: 'slow.mp4', description: '', category: 'standard', slow: true },
  ],
};

describe('gen-video: generator', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-generator-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it.each([
    { scenario: 'the fast fixtures by default', options: {}, ids: ['fast'] },
    {
      scenario: 'the slow ones as well with includeSlow',
      options: { includeSlow: true },
      ids: ['fast', 'slow'],
    },
    { scenario: 'the one named by only, slow or not', options: { only: 'slow' }, ids: ['slow'] },
  ])('selects $scenario', ({ options, ids }) => {
    const selected = selectFixtures(MANIFEST, { outputDir: tmpDir, ...options });

    expect(selected.map((fixture) => fixture.id)).toEqual(ids);
  });

  it('generates the selected fixtures and names each one as it starts', async () => {
    const started: string[] = [];

    const result = await generateAllFixtures({ outputDir: tmpDir, only: 'zero-bytes' }, (id) =>
      started.push(id)
    );

    expect(started).toEqual(['zero-bytes']);
    expect(result).toEqual({ generated: [path.join(tmpDir, 'zero-bytes.mp4')], errors: [] });
  });
});
