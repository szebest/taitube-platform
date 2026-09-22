import { read } from './repo-files';
import { workspaceClosure } from './workspace-closure';

const WORKFLOW = '.github/workflows/load-smoke.yml';
const EXERCISED = ['apps/api', 'apps/worker'];

function triggerPaths(): string[] {
  const paths: string[] = [];
  let inPaths = false;

  for (const line of read(WORKFLOW).split('\n')) {
    if (/^ {4}paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;

    const entry = /^ {6}- "([^"]+)"\s*$/.exec(line);
    if (!entry) break;
    paths.push(entry[1] as string);
  }

  return paths;
}

function covers(pattern: string, dir: string): boolean {
  return pattern.endsWith('/**') && `${dir}/`.startsWith(pattern.slice(0, -2));
}

describe('architecture: the load smoke reruns on what it exercises', () => {
  it('still reads the trigger list out of the workflow', () => {
    expect(triggerPaths()).toContain('tests/load/**');
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
