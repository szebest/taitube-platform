import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { publish, type Retried, repoPath } from './retried/publish';

/** Names every Playwright test that failed and passed on its retry, and fails the run on one. */
export default class PlaywrightRetriedReporter implements Reporter {
  private readonly retried: Retried[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'passed' || result.retry === 0) return;
    this.retried.push({
      file: repoPath(test.location.file),
      test: test.titlePath().filter(Boolean).join(' > '),
    });
  }

  async onEnd(): Promise<{ status: FullResult['status'] } | undefined> {
    publish('playwright', this.retried, process.env.GITHUB_STEP_SUMMARY);
    return this.retried.length > 0 ? { status: 'failed' } : undefined;
  }
}
