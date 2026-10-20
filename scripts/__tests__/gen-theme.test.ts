import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkThemeContrast,
  parseTheme,
  resolveTheme,
} from '../../packages/universal/design-tokens/src/index';
import { expectOk } from '../../packages/server/testing/src/result';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';
import { uiTree } from './ui-tree';

const genTheme = (...argv: string[]) =>
  runEntrypoint(resolve(import.meta.dirname, '../gen-theme.ts'), argv, { PATH: process.env.PATH });

describe('scripts: pnpm gen:theme', () => {
  it('scaffolds a theme from Sand that parses, clears the contrast walk and shows in the CSS', async () => {
    const { root, remove } = uiTree();
    onTestFinished(remove);
    const ui = join(root, 'packages/client/ui/src');

    const scaffold = genTheme('late-dusk', root);
    const { lateDusk } = await import(pathToFileURL(join(ui, 'themes/late-dusk/index.ts')).href);
    const { ramps } = await import(pathToFileURL(join(ui, 'tokens/ref/index.ts')).href);
    const theme = expectOk(resolveTheme(expectOk(parseTheme(lateDusk)), ramps));

    expect(scaffold.status).toBe(0);
    expect(theme).toMatchObject({ id: 'late-dusk', name: 'Late Dusk' });
    expect(checkThemeContrast(theme)).toEqual([]);
    expect(readFileSync(join(ui, 'appearance/registry.ts'), 'utf8')).toContain(
      'themes: [sand, nocturne, lateDusk]'
    );
    expect(readFileSync(join(ui, 'styles/generated/themes.css'), 'utf8')).toContain(
      '[data-theme="late-dusk"]'
    );
  });

  it('refuses an id that would climb out of themes/, before it writes anything', () => {
    const { root, remove } = uiTree();
    onTestFinished(remove);

    const scaffold = genTheme('../../x', root);

    expect(scaffold.status).toBe(1);
    expect(scaffold.stderr).toContain('"../../x" is not a theme id');
    expect(existsSync(join(root, 'packages/client/x'))).toBe(false);
  });
});
