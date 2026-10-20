import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  COMPONENT_KINDS,
  type ComponentKind,
  componentFiles,
  componentFolder,
  componentHome,
  isKebab,
} from './component-templates';

const USAGE =
  'usage: pnpm gen:component <name> --kind primitive|shared|web|studio [--area <area>] [--compound] [root]';

const { values, positionals } = parseArgs({
  options: {
    kind: { type: 'string' },
    area: { type: 'string' },
    compound: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});
const [name = '', rootArg] = positionals;
const { kind = '', area, compound } = values;
const root = resolve(rootArg ?? join(import.meta.dirname, '..'));

const fail = (message: string) => {
  process.stderr.write(`gen:component: ${message}\n`);
  process.exitCode = 1;
};

const isKind = (value: string): value is ComponentKind =>
  COMPONENT_KINDS.some((known) => known === value);

if (name === '' || !isKind(kind)) {
  fail(USAGE);
} else {
  const request = { name, kind, area, compound };
  const notKebab = [name, area].find((part) => part !== undefined && !isKebab(part));
  const folder = join(root, componentFolder(request));
  const owner = dirname(join(root, componentHome(kind)));
  if (notKebab !== undefined) {
    fail(`${JSON.stringify(notKebab)} is not kebab-case: lowercase words joined by hyphens`);
  } else if (!existsSync(owner)) {
    fail(`${owner} does not exist yet, so there is no ${kind} kit to add ${name} to`);
  } else if (existsSync(folder)) {
    fail(`${folder} exists already`);
  } else {
    for (const [file, content] of Object.entries(componentFiles(request))) {
      const target = join(folder, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
      process.stdout.write(`wrote ${target}\n`);
    }
    const biome = join(import.meta.dirname, '../node_modules/.bin/biome');
    spawnSync(biome, ['format', '--write', folder], { cwd: root, stdio: 'ignore' });
    if (kind === 'primitive') {
      process.stdout.write(
        `export it from packages/client/ui/src/index.ts: export * from './primitives/${name}';\n`
      );
    }
  }
}
