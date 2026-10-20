import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { tokenGroups } from '../packages/universal/design-tokens/src/index';
import {
  copySetModule,
  invalidId,
  groupNamed,
  REGISTRY,
  regenerateTokens,
  register,
  setIdentifier,
  UI_SRC,
} from './scaffold';

const USAGE = 'usage: pnpm gen:token-set <group> <id> --from <id> [root]';

const { values, positionals } = parseArgs({
  options: { from: { type: 'string' } },
  allowPositionals: true,
});
const [groupName = '', id = '', rootArg] = positionals;
const { from } = values;
const root = resolve(rootArg ?? join(import.meta.dirname, '..'));
const group = groupNamed(groupName);

const fail = (message: string) => {
  process.stderr.write(`gen:token-set: ${message}\n`);
  process.exitCode = 1;
};

const badId = invalidId([id, from ?? '']);

if (group === undefined || id === '' || from === undefined) {
  fail(USAGE);
} else if (badId !== undefined) {
  fail(
    `${JSON.stringify(badId)} is not a set id: lowercase letters, digits and hyphens, from a letter`
  );
} else {
  const folder = (setId: string) => join(root, UI_SRC, 'tokens', tokenGroups[group].path, setId);
  const target = join(folder(id), 'index.ts');
  const source = await readFile(join(folder(from), 'index.ts'), 'utf8').catch(() => undefined);
  const copy = source === undefined ? undefined : copySetModule(source, { group, from, to: id });
  if (existsSync(target)) {
    fail(`${group} ${id} exists already`);
  } else if (copy === undefined) {
    fail(`${group} ${from} is not a set this script can copy`);
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, copy);
    process.stdout.write(`wrote ${target}\n`);
    const identifier = setIdentifier(group, id);
    const path = `../tokens/${tokenGroups[group].path}/${id}`;
    const registry = await readFile(join(root, REGISTRY), 'utf8');
    const registered = register(registry, { key: group, identifier, path });
    if (registered === undefined) {
      process.stdout.write(
        `add to ${REGISTRY}: import { ${identifier} } from '${path}'; and ${identifier} to offer.${group}\n`
      );
    } else {
      await writeFile(join(root, REGISTRY), registered);
      process.stdout.write(`offered ${identifier} in ${REGISTRY}\n`);
      process.exitCode = regenerateTokens(root);
    }
  }
}
