import type { Reporter, TestCase } from 'vite-plus/test/node';
import { publish, type Retried, repoPath } from './retried/publish';

/** Names every vitest test that failed and passed on its `--retry`, so a retry never hides a flake. */
export default class VitestRetriedReporter implements Reporter {
  private readonly retried: Retried[] = [];

  onTestCaseResult(testCase: TestCase): void {
    const retries = testCase.diagnostic()?.retryCount ?? 0;
    if (testCase.result().state !== 'passed' || retries === 0) return;
    this.retried.push({ file: repoPath(testCase.module.moduleId), test: testCase.fullName });
  }

  onTestRunEnd(): void {
    publish('vitest', this.retried, process.env.GITHUB_STEP_SUMMARY);
  }
}
