import { appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '../..');

/** A spec's path from the repository root, as the timing file and ci:health name it. */
export const repoPath = (absolute: string): string => relative(REPO, absolute);

export interface Retried {
  file: string;
  test: string;
}

/** The annotation title ci:health counts a flake by. */
export const RETRIED_TITLE = 'passed on retry';

const encoded = (text: string): string =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** A GitHub warning annotation per test that failed once and passed on its retry. */
export function annotations(retried: readonly Retried[]): string[] {
  return retried.map(
    ({ file, test }) =>
      `::warning file=${encoded(file)},title=${RETRIED_TITLE}::${encoded(`${file} > ${test}`)}`
  );
}

export function summary(suite: string, retried: readonly Retried[]): string {
  if (retried.length === 0) return '';
  return [
    `### ${suite}: ${retried.length} passed on retry`,
    '',
    '| Spec | Test |',
    '| --- | --- |',
    ...retried.map(({ file, test }) => `| ${file} | ${test.replace(/\|/g, '\\|')} |`),
    '',
  ].join('\n');
}

/** Prints the annotations and, in a GitHub job, appends the table to its summary. */
export function publish(
  suite: string,
  retried: readonly Retried[],
  summaryFile: string | undefined
): void {
  if (retried.length === 0) return;
  process.stdout.write(`${annotations(retried).join('\n')}\n`);
  if (summaryFile) appendFileSync(summaryFile, `${summary(suite, retried)}\n`);
}
