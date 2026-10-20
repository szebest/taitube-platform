import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTokenSet } from '../../packages/universal/design-tokens/src/index';
import { expectOk } from '../../packages/server/testing/src/result';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';
import { uiTree } from './ui-tree';

const run = (script: string, ...argv: string[]) =>
  runEntrypoint(resolve(import.meta.dirname, `../${script}`), argv, { PATH: process.env.PATH });

const SETS_CSS = 'packages/client/ui/src/styles/generated/sets.css';
const REGISTRY = 'packages/client/ui/src/appearance/registry.ts';

describe('scripts: pnpm gen:token-set', () => {
  it('scaffolds a set that parses, is offered and shows in the CSS, and is absent once no longer offered', async () => {
    const { root, remove } = uiTree();
    onTestFinished(remove);
    const registry = readFileSync(join(root, REGISTRY), 'utf8');

    const scaffold = run('gen-token-set.ts', 'shadow', 'dramatic', '--from', 'deep', root);
    const module = join(root, 'packages/client/ui/src/tokens/shadow/dramatic/index.ts');
    const { shadowDramatic } = await import(pathToFileURL(module).href);

    expect(scaffold.status).toBe(0);
    expect(expectOk(parseTokenSet('shadow', shadowDramatic)).id).toBe('dramatic');
    expect(readFileSync(join(root, REGISTRY), 'utf8')).toContain(
      '[shadowFlat, shadowSoft, shadowDeep, shadowDramatic]'
    );
    expect(readFileSync(join(root, SETS_CSS), 'utf8')).toContain('[data-shadow="dramatic"]');

    writeFileSync(join(root, REGISTRY), registry);
    expect(run('gen-tokens.ts', root).status).toBe(0);
    expect(readFileSync(join(root, SETS_CSS), 'utf8')).not.toContain('[data-shadow="dramatic"]');
  });

  it.each([
    {
      label: 'an unknown group',
      argv: ['fonts', 'x', '--from', 'deep'],
      error: 'usage: pnpm gen:token-set',
    },
    {
      label: 'an id that exists',
      argv: ['shadow', 'deep', '--from', 'soft'],
      error: 'shadow deep exists already',
    },
  ])('refuses $label', ({ argv, error }) => {
    const { root, remove } = uiTree();
    onTestFinished(remove);

    const scaffold = run('gen-token-set.ts', ...argv, root);

    expect(scaffold.status).toBe(1);
    expect(scaffold.stderr).toContain(error);
  });
});
