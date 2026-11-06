import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestModule, Vitest } from 'vite-plus/test/node';
import TimingsReporter, { moduleCost } from '../timings-reporter';

const diagnostic = {
  environmentSetupDuration: 120.4,
  prepareDuration: 10,
  collectDuration: 900,
  setupDuration: 30,
  duration: 400,
};

const testModule = (moduleId: string) =>
  ({ moduleId, diagnostic: () => diagnostic }) as unknown as TestModule;

const reporter = (outputFile: unknown) => {
  const subject = new TimingsReporter();
  subject.onInit({ config: { root: '/repo', outputFile } } as unknown as Vitest);
  return subject;
};

describe('TimingsReporter', () => {
  it('costs a spec file its environment, harness, import, setup and tests', () => {
    expect(moduleCost(testModule('/repo/a.test.ts'))).toBe(1460);
  });

  it('writes each file by its path from the root to --outputFile.timings', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'timings-')), 'shard-1.json');

    reporter({ timings: file }).onTestRunEnd([testModule('/repo/apps/a.test.ts')]);

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([['apps/a.test.ts', 1460]]);
  });
});
