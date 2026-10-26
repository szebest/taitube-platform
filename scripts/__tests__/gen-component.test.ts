import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const genComponent = (...argv: string[]) =>
  runEntrypoint(resolve(import.meta.dirname, '../gen-component.ts'), argv, {
    PATH: process.env.PATH,
  });

/** An empty repo root holding only the app and package folders a kit is written into. */
function repoRoot() {
  const root = mkdtempSync(join(tmpdir(), 'gen-component-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ['apps/client/web/src', 'packages/client/ui/src']) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  return root;
}

describe('scripts: pnpm gen:component', () => {
  it('scaffolds a compound web component in its area', () => {
    const root = repoRoot();

    const scaffold = genComponent(
      'chip-bar',
      '--kind',
      'web',
      '--area',
      'discovery',
      '--compound',
      root
    );

    expect(scaffold.status).toBe(0);
    expect(readdirSync(join(root, 'apps/client/web/src/components/discovery/chip-bar'))).toContain(
      'chip-bar.context.ts'
    );
  });

  it.each([
    {
      refused: 'a name that would climb out of the kit',
      argv: ['../x', '--kind', 'web'],
      says: 'is not kebab-case',
    },
    {
      refused: 'an area that is not kebab-case',
      argv: ['chip-bar', '--kind', 'web', '--area', 'A/b'],
      says: 'is not kebab-case',
    },
    { refused: 'an unknown kind', argv: ['chip-bar', '--kind', 'page'], says: 'usage:' },
    {
      refused: 'a kit whose package does not exist yet',
      argv: ['chip-bar', '--kind', 'shared'],
      says: 'does not exist yet',
    },
  ])('refuses $refused before it writes anything', ({ argv, says }) => {
    const root = repoRoot();

    const scaffold = genComponent(...argv, root);

    expect(scaffold.status).toBe(1);
    expect(scaffold.stderr).toContain(says);
    expect(existsSync(join(root, 'apps/client/web/src/components'))).toBe(false);
  });

  it('refuses a folder that exists already', () => {
    const root = repoRoot();
    genComponent('kbd', '--kind', 'primitive', root);

    const again = genComponent('kbd', '--kind', 'primitive', root);

    expect(again.status).toBe(1);
    expect(again.stderr).toContain('exists already');
  });
});
