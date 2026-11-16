import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findMachineFiles } from '../discover';

function tree(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'state-machines-discover-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return root;
}

describe('scripts: state-machines/discover', () => {
  it('lists machine files under apps and packages in path order', async () => {
    const root = tree([
      'packages/b/src/b.machine.ts',
      'apps/server/api/src/a.machine.ts',
      'packages/b/src/b.ts',
    ]);

    expect(await findMachineFiles(root)).toEqual([
      'apps/server/api/src/a.machine.ts',
      'packages/b/src/b.machine.ts',
    ]);
  });

  it.each(['node_modules', 'dist', '.turbo'])('skips a %s folder', async (folder) => {
    const root = tree([`packages/a/${folder}/x.machine.ts`, 'packages/a/src/y.machine.ts']);

    expect(await findMachineFiles(root)).toEqual(['packages/a/src/y.machine.ts']);
  });

  it('finds nothing in a tree without the roots', async () => {
    expect(await findMachineFiles(tree(['docs/z.machine.ts']))).toEqual([]);
  });
});
