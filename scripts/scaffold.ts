import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PREFERENCE_ID_PATTERN } from '../packages/universal/domain/src/settings/index';
import {
  TOKEN_GROUPS,
  type TokenGroup,
  tokenGroups,
} from '../packages/universal/design-tokens/src/index';

export const UI_SRC = 'packages/client/ui/src';

export const REGISTRY = `${UI_SRC}/appearance/registry.ts`;

const words = (kebab: string) =>
  kebab.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1));

const pascal = (kebab: string) => words(kebab).join('');

const camel = (kebab: string) => {
  const joined = pascal(kebab);
  return joined.charAt(0).toLowerCase() + joined.slice(1);
};

const themeName = (id: string) => words(id).join(' ');

/**
 * The first of `ids` an account could not store (`PREFERENCE_ID_PATTERN`), checked before any write:
 * an id becomes a folder, an identifier and a registry line, so `../x` or `a'b` must never get that far.
 */
export const invalidId = (ids: readonly string[]) =>
  ids.find((id) => !PREFERENCE_ID_PATTERN.test(id));

/** A group named by its camelCase key (`fontSize`) or its kebab path (`font-size`). */
export const groupNamed = (name: string): TokenGroup | undefined =>
  TOKEN_GROUPS.find((group) => group === name || tokenGroups[group].path === name);

export const setIdentifier = (group: TokenGroup, id: string) => `${group}${pascal(id)}`;

export const themeIdentifier = (id: string) => camel(id);

/** A copy of set `from`'s module as set `to`, or `undefined` when it is not the shape a scaffold writes. */
export function copySetModule(
  source: string,
  { group, from, to }: Readonly<{ group: TokenGroup; from: string; to: string }>
): string | undefined {
  const head = `export const ${setIdentifier(group, from)} = defineTokenSet('${group}', '${from}', {`;
  return source.includes(head)
    ? source.replace(
        head,
        `export const ${setIdentifier(group, to)} = defineTokenSet('${group}', '${to}', {`
      )
    : undefined;
}

/** A copy of theme `from`'s module as theme `to`, or `undefined` when it is not the shape a scaffold writes. */
export function copyThemeModule(
  source: string,
  { from, to }: Readonly<{ from: string; to: string }>
): string | undefined {
  const head = `export const ${themeIdentifier(from)} = defineTheme({\n  id: '${from}',\n  name: '${themeName(from)}',`;
  return source.includes(head)
    ? source.replace(
        head,
        `export const ${themeIdentifier(to)} = defineTheme({\n  id: '${to}',\n  name: '${themeName(to)}',`
      )
    : undefined;
}

const IMPORT = /^import \{ (\w+) \} from '(\.\.\/[^']+)';$/;

/**
 * The registry with `identifier` imported from `path` and appended to the one-line list `key`
 * (`themes`, or a group of `offer`), or `undefined` when that list is not on one line and the
 * edit is no longer safe as text.
 */
export function register(
  registry: string,
  { key, identifier, path }: Readonly<{ key: string; identifier: string; path: string }>
): string | undefined {
  const lines = registry.split('\n');
  const list = lines.findIndex((line) => new RegExp(`^ +${key}: \\[[\\w, ]+\\],$`).test(line));
  if (list === -1) {
    return undefined;
  }
  lines[list] = lines[list]?.replace(/\],$/, `, ${identifier}],`) ?? '';
  const imports = lines.flatMap((line, index) => {
    const match = IMPORT.exec(line);
    return match ? [{ index, path: match[2] ?? '' }] : [];
  });
  const before = imports.findLast((entry) => entry.path < path) ?? imports[0];
  const at = before === undefined ? 1 : before.index + (before.path < path ? 1 : 0);
  lines.splice(at, 0, `import { ${identifier} } from '${path}';`);
  return lines.join('\n');
}

/** Runs `pnpm gen:tokens` over `root` the way this script runs, so the CSS and tokens.json follow. */
export function regenerateTokens(root: string): number {
  const run = spawnSync(
    process.execPath,
    [...process.execArgv, join(import.meta.dirname, 'gen-tokens.ts'), root],
    {
      stdio: 'inherit',
    }
  );
  return run.status ?? 1;
}
