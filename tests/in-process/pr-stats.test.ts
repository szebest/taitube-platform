import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT } from '../architecture/repo-files';

const PR_STATS = join(ROOT, '.agents/skills/git-and-pr-conventions/scripts/pr_stats.py');

function git(repo: string, args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=spec', '-c', 'user.email=spec@example.com', ...args],
    { cwd: repo, encoding: 'utf8' }
  );
}

function write(repo: string, path: string, text: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function prStats(repo: string, args: string[]): string {
  return execFileSync('python3', [PR_STATS, ...args], { cwd: repo, encoding: 'utf8' });
}

describe('pr_stats.py', () => {
  let repo = '';

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'pr-stats-'));
    git(repo, ['init', '-q', '-b', 'main']);
    write(repo, 'src/moved.ts', 'export const moved = 1;\n'.repeat(5));
    write(repo, 'src/gone.ts', 'export const gone = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'base']);

    mkdirSync(join(repo, 'src/lib'));
    git(repo, ['mv', 'src/moved.ts', 'src/lib/moved.ts']);
    git(repo, ['rm', '-q', 'src/gone.ts']);
    write(repo, 'src/new.ts', 'export const added = 1;\nexport const more = 2;\n');
    write(repo, 'src/__tests__/new.test.ts', "it('adds', () => {});\n");
    write(repo, 'docs/guide.md', '# Guide\n');
    write(repo, '.agents/skills/x/scripts/tool.py', 'print(1)\n');
    write(repo, 'package.json', '{}\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'head']);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true });
  });

  it('splits the change by kind, counting a pure move as changed with no lines', () => {
    expect(prStats(repo, ['HEAD~1', 'HEAD'])).toBe(
      [
        '| Kind | Files | New | Changed | Deleted | Lines + | Lines - |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| Production code | 3 | 1 | 1 | 1 | +2 | -1 |',
        '| Tests | 1 | 1 | 0 | 0 | +1 | -0 |',
        '| Docs and skills | 2 | 2 | 0 | 0 | +2 | -0 |',
        '| Config and build | 1 | 1 | 0 | 0 | +1 | -0 |',
        '| **Total** | **7** | 5 | 1 | 1 | +6 | -1 |',
        '',
      ].join('\n')
    );
  });

  it('lists every file under its kind with its status letter', () => {
    expect(prStats(repo, ['HEAD~1', 'HEAD', '--files'])).toContain(
      ['Production code:', '  A src/new.ts', '  D src/gone.ts', '  R src/lib/moved.ts'].join('\n')
    );
  });
});
