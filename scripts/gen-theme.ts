import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  copyThemeModule,
  REGISTRY,
  regenerateTokens,
  register,
  themeIdentifier,
  UI_SRC,
} from './scaffold';

const USAGE = 'usage: pnpm gen:theme <id> [--from <theme>] [root]';

const DEFAULT_SOURCE = 'sand';

const { values, positionals } = parseArgs({
  options: { from: { type: 'string', default: DEFAULT_SOURCE } },
  allowPositionals: true,
});
const [id = '', rootArg] = positionals;
const { from } = values;
const root = resolve(rootArg ?? join(import.meta.dirname, '..'));

const fail = (message: string) => {
  process.stderr.write(`gen:theme: ${message}\n`);
  process.exitCode = 1;
};

if (id === '') {
  fail(USAGE);
} else {
  const folder = (themeId: string) => join(root, UI_SRC, 'themes', themeId);
  const target = join(folder(id), 'index.ts');
  const source = await readFile(join(folder(from), 'index.ts'), 'utf8').catch(() => undefined);
  const copy = source === undefined ? undefined : copyThemeModule(source, { from, to: id });
  if (existsSync(target)) {
    fail(`theme ${id} exists already`);
  } else if (copy === undefined) {
    fail(`theme ${from} is not a theme this script can copy`);
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, copy);
    process.stdout.write(`wrote ${target}\n`);
    const identifier = themeIdentifier(id);
    const path = `../themes/${id}`;
    const registry = await readFile(join(root, REGISTRY), 'utf8');
    const registered = register(registry, { key: 'themes', identifier, path });
    if (registered === undefined) {
      process.stdout.write(
        `add to ${REGISTRY}: import { ${identifier} } from '${path}'; and ${identifier} to themes\n`
      );
    } else {
      await writeFile(join(root, REGISTRY), registered);
      process.stdout.write(`registered ${identifier} in ${REGISTRY}\n`);
      process.exitCode = regenerateTokens(root);
    }
  }
}
