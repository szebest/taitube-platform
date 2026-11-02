import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '../..');

interface VitestReport {
  testResults: { name: string; status: string }[];
}

interface PlaywrightSuite {
  file?: string;
  specs?: { tests: { results: { status: string }[] }[] }[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  config: { rootDir: string };
  suites: PlaywrightSuite[];
}

const failedRun = (status: string): boolean => status === 'failed' || status === 'timedOut';

function playwrightFailures(suite: PlaywrightSuite, rootDir: string): string[] {
  const own = (suite.specs ?? []).some((spec) =>
    spec.tests.some((test) => test.results.some(({ status }) => failedRun(status)))
  );
  return [
    ...(own && suite.file ? [relative(REPO, join(rootDir, suite.file))] : []),
    ...(suite.suites ?? []).flatMap((child) => playwrightFailures(child, rootDir)),
  ];
}

/** The spec files that failed at least once in a vitest or Playwright JSON report, by repo path. */
export function failingSpecs(report: VitestReport | PlaywrightReport): string[] {
  const { testResults } = report as Partial<VitestReport>;
  const files = testResults
    ? testResults
        .filter(({ status }) => status === 'failed')
        .map(({ name }) => relative(REPO, name))
    : (report as PlaywrightReport).suites.flatMap((suite) =>
        playwrightFailures(suite, (report as PlaywrightReport).config.rootDir)
      );
  return [...new Set(files)].sort();
}

export const issueTitle = (spec: string): string => `Flaky spec: ${spec}`;
