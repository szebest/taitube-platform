import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkFixture } from '../check-fixture';
import type { FixtureDefinition } from '../types';

const fixture: FixtureDefinition = {
  id: 'absent',
  filename: 'absent.mp4',
  description: 'a fixture that was never generated',
  category: 'standard',
  slow: false,
};

describe('gen-video: fixture verification', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-check-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails a fixture whose file is missing and says so', () => {
    const result = checkFixture(fixture, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.id).toBe('absent');
    expect(result.message).toMatch(/does not exist/i);
  });

  it('fails a fixture whose file is present but unreadable as media', () => {
    fs.writeFileSync(path.join(tmpDir, 'absent.mp4'), 'not a container');
    const result = checkFixture(fixture, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.message).toBeTruthy();
  });
});
