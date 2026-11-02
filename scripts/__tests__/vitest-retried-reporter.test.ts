import { join } from 'node:path';
import type { TestCase } from 'vitest/node';
import { publish } from '../retried/publish';
import VitestRetriedReporter from '../vitest-retried-reporter';

vi.mock(import('../retried/publish'), async (importOriginal) => ({
  ...(await importOriginal()),
  publish: vi.fn(),
}));

const testCase = (state: string, retryCount: number) =>
  ({
    fullName: 'shell rail > lists the channels',
    module: { moduleId: join(import.meta.dirname, '../../apps/client/web/src/a.dom.test.tsx') },
    result: () => ({ state }),
    diagnostic: () => ({ retryCount }),
  }) as unknown as TestCase;

describe('VitestRetriedReporter', () => {
  it.each([
    { scenario: 'a pass on its retry', state: 'passed', retryCount: 1, reported: 1 },
    { scenario: 'a first-time pass', state: 'passed', retryCount: 0, reported: 0 },
    { scenario: 'a failure after its retry', state: 'failed', retryCount: 1, reported: 0 },
  ])('reports $scenario: $reported', ({ state, retryCount, reported }) => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '/summary.md');
    const reporter = new VitestRetriedReporter();

    reporter.onTestCaseResult(testCase(state, retryCount));
    reporter.onTestRunEnd();

    const expected = [
      { file: 'apps/client/web/src/a.dom.test.tsx', test: 'shell rail > lists the channels' },
    ];
    expect(publish).toHaveBeenCalledWith('vitest', reported ? expected : [], '/summary.md');
  });
});
