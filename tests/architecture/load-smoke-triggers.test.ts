import { load } from 'js-yaml';
import { read } from './repo-files';
import { workspaceClosure } from './workspace-closure';

const WORKFLOW = '.github/workflows/load-smoke.yml';
const EXERCISED = ['apps/api', 'apps/worker'];
const DOCUMENTS_ONLY = '!**/*.md';

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return new Map(Object.entries(value)).get(key);
}

function triggerPaths(workflowYaml: string): string[] {
  const workflow: unknown = load(workflowYaml);
  const paths = field(field(field(workflow, 'on'), 'pull_request'), 'paths');
  if (!Array.isArray(paths)) return [];
  return paths.filter((path): path is string => typeof path === 'string');
}

function covers(pattern: string, dir: string): boolean {
  return pattern.endsWith('/**') && `${dir}/`.startsWith(pattern.slice(0, -2));
}

/** What a pull request's paths filter lets through that it should not, or misses that it should run on. */
function triggerFindings(paths: readonly string[], exercised: readonly string[]): string[] {
  const findings = exercised
    .filter((dir) => !paths.some((pattern) => covers(pattern, dir)))
    .map((dir) => `does not run on ${dir}`);
  if (paths.at(-1) !== DOCUMENTS_ONLY) findings.push(`does not end with ${DOCUMENTS_ONLY}`);
  return findings;
}

describe('architecture: the load smoke reruns on what it exercises, and skips documents', () => {
  it('fires on a filter missing a runtime package and on one that runs on a changed document', () => {
    const fixture = [
      'on:',
      '  pull_request:',
      '    paths:',
      '      - "apps/api/**"',
      '      - "tests/load/**"',
    ].join('\n');

    expect(triggerFindings(triggerPaths(fixture), ['apps/api', 'packages/server/db'])).toEqual([
      'does not run on packages/server/db',
      `does not end with ${DOCUMENTS_ONLY}`,
    ]);
  });

  it('covers every workspace package the API and the worker resolve at runtime, and no document', () => {
    const paths = triggerPaths(read(WORKFLOW));
    const exercised = [
      ...new Set(EXERCISED.flatMap((app) => [app, ...workspaceClosure(app, 'runtime')])),
    ];

    expect(paths).toContain('tests/load/**');
    expect(triggerFindings(paths, exercised)).toEqual([]);
  });
});
