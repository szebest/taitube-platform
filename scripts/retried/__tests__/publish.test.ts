import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { annotations, publish, repoPath, summary } from '../publish';

const RETRIED = [
  { file: 'apps/client/web/e2e/start-here.test.ts', test: 'start here > pins | orders' },
];

describe('publish', () => {
  it('names the file and the test in an error titled for ci:health', () => {
    expect(annotations([{ file: 'a.test.ts', test: 'line one\nline two' }])).toEqual([
      '::error file=a.test.ts,title=passed on retry::a.test.ts > line one%0Aline two',
    ]);
  });

  it('tables the retried tests for the job summary, and nothing when none was retried', () => {
    expect(summary('playwright', RETRIED)).toContain(
      '| apps/client/web/e2e/start-here.test.ts | start here > pins \\| orders |'
    );
    expect(summary('playwright', [])).toBe('');
  });

  it('appends the table to the summary file, prints the annotations and fails the run', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'summary-')), 'summary.md');
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const exitCode = process.exitCode;

    try {
      publish('vitest', RETRIED, file);

      expect(readFileSync(file, 'utf8')).toContain('### vitest: 1 passed on retry');
      expect(write).toHaveBeenCalledWith(`${annotations(RETRIED)[0]}\n`);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = exitCode;
    }
  });

  it('leaves the run as it is when no test needed its retry', () => {
    publish('vitest', [], undefined);

    expect(process.exitCode).toBeUndefined();
  });

  it('reads a spec path from the repository root', () => {
    expect(repoPath(join(import.meta.dirname, '../../../apps/a.test.ts'))).toBe('apps/a.test.ts');
  });
});
