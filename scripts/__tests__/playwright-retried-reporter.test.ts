import { join } from 'node:path';
import type { TestCase, TestResult } from '@playwright/test/reporter';
import PlaywrightRetriedReporter from '../playwright-retried-reporter';
import { publish } from '../retried/publish';

vi.mock(import('../retried/publish'), async (importOriginal) => ({
  ...(await importOriginal()),
  publish: vi.fn(),
}));

const test = {
  location: { file: join(import.meta.dirname, '../../apps/client/web/e2e/start-here.test.ts') },
  titlePath: () => ['', 'chromium', 'start-here.test.ts', 'start here', 'pins three videos'],
} as unknown as TestCase;

describe('PlaywrightRetriedReporter', () => {
  it.each([
    {
      scenario: 'a pass on its retry',
      status: 'passed',
      retry: 1,
      reported: 1,
      ends: { status: 'failed' },
    },
    { scenario: 'a first-time pass', status: 'passed', retry: 0, reported: 0, ends: undefined },
    {
      scenario: 'a failure on its retry',
      status: 'failed',
      retry: 1,
      reported: 0,
      ends: undefined,
    },
  ])('reports $scenario: $reported', async ({ status, retry, reported, ends }) => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '/summary.md');
    const reporter = new PlaywrightRetriedReporter();

    reporter.onTestEnd(test, { status, retry } as TestResult);
    const result = await reporter.onEnd();

    const expected = [
      {
        file: 'apps/client/web/e2e/start-here.test.ts',
        test: 'chromium > start-here.test.ts > start here > pins three videos',
      },
    ];
    expect(publish).toHaveBeenCalledWith('playwright', reported ? expected : [], '/summary.md');
    expect(result).toEqual(ends);
  });
});
