import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkFixture } from '../check-fixture';
import type { FixtureDefinition } from '../types';

function fixtureNamed(id: string): FixtureDefinition {
  return { id, filename: `${id}.mp4`, description: id, category: 'hostile', slow: false };
}

describe('gen-video: fixture verification', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-check-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails a fixture whose file is missing and says so', () => {
    const result = checkFixture(fixtureNamed('absent'), tmpDir);

    expect(result).toMatchObject({ id: 'absent', passed: false });
    expect(result.message).toMatch(/does not exist/i);
  });

  it('fails a standard fixture whose file ffprobe cannot read', () => {
    fs.writeFileSync(path.join(tmpDir, 'unreadable.mp4'), 'not a container');

    const result = checkFixture({ ...fixtureNamed('unreadable'), category: 'standard' }, tmpDir);

    expect(result).toMatchObject({
      passed: false,
      message: 'ffprobe failed to read file metadata',
    });
  });

  it.each([
    { id: 'zero-bytes', content: '', passed: true },
    { id: 'zero-bytes', content: 'x', passed: false },
    { id: 'not-a-video', content: 'plain text', passed: true },
  ])('passes $id holding $content.length bytes: $passed', ({ id, content, passed }) => {
    fs.writeFileSync(path.join(tmpDir, `${id}.mp4`), content);

    expect(checkFixture(fixtureNamed(id), tmpDir).passed).toBe(passed);
  });
});
