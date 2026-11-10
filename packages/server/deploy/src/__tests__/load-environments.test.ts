import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { environmentDirs, loadEnvironments } from '../load-environments';
import { PRODUCTION } from './fixtures';

let root: string;

function write(dir: string, file: string, text: string): void {
  mkdirSync(join(root, 'infra/environments', dir), { recursive: true });
  writeFileSync(join(root, 'infra/environments', dir, file), text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vp-envs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loading environments', () => {
  it('has no environments when the directory is absent', () => {
    expect(environmentDirs(root)).toEqual([]);
  });

  it('skips underscore directories, the template among them', () => {
    write('_template', 'environment.yaml', 'x');
    write('production', 'environment.yaml', dump(PRODUCTION));

    expect(environmentDirs(root)).toEqual(['production']);
  });

  it('loads valid files and reports the ones that are missing or wrong', () => {
    write('production', 'environment.yaml', dump(PRODUCTION));
    write('empty', 'README.md', '');
    write('broken', 'environment.yaml', 'name: broken\n');

    const { environments, problems } = loadEnvironments(root);

    expect(environments.map((env) => env.name)).toEqual(['production']);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('empty: infra/environments/empty/environment.yaml is missing'),
      ])
    );
    expect(problems.some((problem) => problem.startsWith('broken: '))).toBe(true);
  });
});
