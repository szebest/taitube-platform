import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { publish, type Retried, repoPath } from './retried/publish';

/** Names every Playwright test that failed and passed on its retry, so a retry never hides a flake. */
export default class PlaywrightRetriedReporter implements Reporter {
  private readonly retried: Retried[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'passed' || result.retry === 0) return;
    this.retried.push({
      file: repoPath(test.location.file),
      test: test.titlePath().filter(Boolean).join(' > '),
    });
  }

  onEnd(): void {
    publish('playwright', this.retried, process.env.GITHUB_STEP_SUMMARY);
  }
}
