import { load } from 'js-yaml';
import { read } from './repo-files';
import { workspaceClosure } from './workspace-closure';

const WORKFLOW = '.github/workflows/load-smoke.yml';
const EXERCISED = ['apps/api', 'apps/worker'];

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return new Map(Object.entries(value)).get(key);
}

function triggerPaths(): string[] {
  const workflow: unknown = load(read(WORKFLOW));
  const paths = field(field(field(workflow, 'on'), 'pull_request'), 'paths');
  if (!Array.isArray(paths)) return [];
  return paths.filter((path): path is string => typeof path === 'string');
}

function covers(pattern: string, dir: string): boolean {
  return pattern.endsWith('/**') && `${dir}/`.startsWith(pattern.slice(0, -2));
}

describe('architecture: the load smoke reruns on what it exercises', () => {
  it('still reads the trigger list out of the workflow', () => {
    expect(triggerPaths()).toContain('tests/load/**');
  });

  it('skips a pull request that changes documents only', () => {
    expect(triggerPaths().at(-1)).toBe('!**/*.md');
  });

  it('covers every workspace package the API and the worker resolve at runtime', () => {
    const paths = triggerPaths();
    const exercised = [
      ...new Set(EXERCISED.flatMap((app) => [app, ...workspaceClosure(app, 'runtime')])),
    ];
    const uncovered = exercised.filter((dir) => !paths.some((pattern) => covers(pattern, dir)));

    expect(uncovered).toEqual([]);
  });
});
