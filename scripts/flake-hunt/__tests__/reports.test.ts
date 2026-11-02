import { join } from 'node:path';
import { failingSpecs, issueTitle } from '../reports';

const REPO = join(import.meta.dirname, '../../..');

describe('flake-hunt reports', () => {
  it.each([
    {
      format: 'vitest',
      report: {
        testResults: [
          { name: join(REPO, 'apps/client/web/src/a.dom.test.tsx'), status: 'failed' },
          { name: join(REPO, 'apps/client/web/src/b.dom.test.tsx'), status: 'passed' },
        ],
      },
      failing: ['apps/client/web/src/a.dom.test.tsx'],
    },
    {
      format: 'Playwright',
      report: {
        config: { rootDir: join(REPO, 'apps/client/web/e2e') },
        suites: [
          {
            file: 'shorts.test.ts',
            specs: [{ tests: [{ results: [{ status: 'passed' }, { status: 'failed' }] }] }],
          },
          { file: 'watch.test.ts', specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] },
        ],
      },
      failing: ['apps/client/web/e2e/shorts.test.ts'],
    },
  ])('lists the spec files a $format report failed at least once', ({ report, failing }) => {
    expect(failingSpecs(report)).toEqual(failing);
  });

  it('titles the one issue a flaky spec gets', () => {
    expect(issueTitle('apps/client/web/e2e/shorts.test.ts')).toBe(
      'Flaky spec: apps/client/web/e2e/shorts.test.ts'
    );
  });
});
