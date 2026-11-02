import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { failingSpecs, issueTitle } from './flake-hunt/reports';
import { readQuarantine, unquarantined } from './quarantine/entries';

const gh = (args: readonly string[]): string => execFileSync('gh', args, { encoding: 'utf8' });

/** Opens one issue per flaky spec, or comments on the open one, linking the run that caught it. */
function report(spec: string, runUrl: string): void {
  const title = issueTitle(spec);
  const body = `\`${spec}\` failed at least once in the flake hunt: ${runUrl}`;
  const open = gh([
    'issue',
    'list',
    '--state',
    'open',
    '--search',
    `in:title "${title}"`,
    '--json',
    'number,title',
  ]);
  const number = (JSON.parse(open) as { number: number; title: string }[]).find(
    (issue) => issue.title === title
  )?.number;
  if (number === undefined) gh(['issue', 'create', '--title', title, '--body', body]);
  else gh(['issue', 'comment', String(number), '--body', body]);
}

/** Lists the specs that failed in the given JSON reports, files them, and fails on any not quarantined. */
function main(): void {
  const { values, positionals } = parseArgs({
    options: { 'run-url': { type: 'string' } },
    allowPositionals: true,
  });
  const failing = [
    ...new Set(positionals.flatMap((file) => failingSpecs(JSON.parse(readFileSync(file, 'utf8'))))),
  ];
  for (const spec of failing) {
    process.stdout.write(`flaky: ${spec}\n`);
    if (values['run-url']) report(spec, values['run-url']);
  }
  const loose = unquarantined(failing, readQuarantine());
  if (loose.length > 0) {
    process.stderr.write(`${loose.length} flaky specs are not in tests/quarantine.json\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) main();
