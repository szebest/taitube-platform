import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const stripTwPrefix = (root: string) =>
  runEntrypoint(resolve(import.meta.dirname, '../strip-tw-prefix.ts'), [root], {
    PATH: process.env.PATH,
  });

function treeOf(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'strip-tw-prefix-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  }
  return { root, read: (file: string) => readFileSync(join(root, file), 'utf8') };
}

describe('scripts: strip-tw-prefix', () => {
  it.each([
    {
      shape: 'a className string',
      before: '<p className="tw:flex tw:-mt-2 tw:hover:bg-tint tw:max-medium:p-2" />',
      after: '<p className="flex -mt-2 hover:bg-tint max-medium:p-2" />',
    },
    {
      shape: 'a variants object',
      before: "tv({ base: 'tw:inline-flex', variants: { size: { sm: `tw:size-4` } } })",
      after: "tv({ base: 'inline-flex', variants: { size: { sm: `size-4` } } })",
    },
    {
      shape: 'an arbitrary value and an important utility',
      before: "'tw:origin-(--radix-select-content-transform-origin) tw:p-1!'",
      after: "'origin-(--radix-select-content-transform-origin) p-1!'",
    },
    {
      shape: 'a word that only ends in tw',
      before: "const note = 'btw:fine';",
      after: "const note = 'btw:fine';",
    },
  ])('rewrites $shape', ({ before, after }) => {
    const { root, read } = treeOf({ 'apps/client/web/src/a.tsx': before });

    const run = stripTwPrefix(root);

    expect(run.status).toBe(0);
    expect(read('apps/client/web/src/a.tsx')).toBe(after);
  });

  it('reaches every client app and package, and nothing else', () => {
    const { root, read } = treeOf({
      'apps/client/studio/src/b.ts': "'tw:flex'",
      'packages/client/ui/src/c.tsx': "'tw:flex'",
      'packages/server/core/src/d.ts': "'tw:flex'",
      'docs/design/e.tsx': "'tw:flex'",
    });

    const run = stripTwPrefix(root);

    expect(run.stdout).toBe('strip-tw-prefix: 2 files rewritten\n');
    expect(read('apps/client/studio/src/b.ts')).toBe("'flex'");
    expect(read('packages/client/ui/src/c.tsx')).toBe("'flex'");
    expect(read('packages/server/core/src/d.ts')).toBe("'tw:flex'");
    expect(read('docs/design/e.tsx')).toBe("'tw:flex'");
  });

  it('finds nothing to do on a second run', () => {
    const { root } = treeOf({ 'apps/client/web/src/a.tsx': "'tw:flex'" });

    stripTwPrefix(root);

    expect(stripTwPrefix(root).stdout).toBe('strip-tw-prefix: 0 files rewritten\n');
  });
});
