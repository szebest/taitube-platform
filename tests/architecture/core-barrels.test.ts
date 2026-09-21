import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const CORE = 'packages/server/core';
const CORE_FOLDERS = ['domain', 'pagination', 'ports', 'repositories'];
const RE_EXPORT = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;

async function sources(pattern: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of glob(pattern, { cwd: ROOT })) files.push(entry);
  return files;
}

describe('architecture: core barrels and port file names', () => {
  it.each(CORE_FOLDERS.map((folder) => ({ folder })))(
    'keeps the $folder barrel inside its own folder',
    ({ folder }) => {
      const barrel = readFileSync(join(ROOT, CORE, folder, 'index.ts'), 'utf8');
      const reached = [...barrel.matchAll(RE_EXPORT)]
        .map((match) => match[1] as string)
        .filter((specifier) => !specifier.startsWith('./'));

      expect(reached).toEqual([]);
    }
  );

  it('spells every port file without a .port suffix', async () => {
    const offenders = await sources('{apps,packages}/**/*.port.ts');

    expect(offenders.filter((file) => !file.includes('node_modules'))).toEqual([]);
  });
});
