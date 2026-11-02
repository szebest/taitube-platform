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
    { scenario: 'a pass on its retry', status: 'passed', retry: 1, reported: 1 },
    { scenario: 'a first-time pass', status: 'passed', retry: 0, reported: 0 },
    { scenario: 'a failure on its retry', status: 'failed', retry: 1, reported: 0 },
  ])('reports $scenario: $reported', ({ status, retry, reported }) => {
    const reporter = new PlaywrightRetriedReporter();

    reporter.onTestEnd(test, { status, retry } as TestResult);
    reporter.onEnd();

    const expected = [
      {
        file: 'apps/client/web/e2e/start-here.test.ts',
        test: 'chromium > start-here.test.ts > start here > pins three videos',
      },
    ];
    expect(publish).toHaveBeenCalledWith('playwright', reported ? expected : [], undefined);
  });
});
