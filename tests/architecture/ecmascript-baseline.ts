import { join } from 'node:path';
import ts from 'typescript';
import { ROOT, trackedFiles } from './repo-files';

export interface EcmaScriptLevel {
  target: ts.ScriptTarget;
  lib: readonly string[];
}

/** A config that sets neither: it is a base other configs extend, and each tier's preset sets the level. */
export const UNSET = 'unset' as const;

export const SERVER: EcmaScriptLevel = {
  target: ts.ScriptTarget.ES2025,
  lib: ['lib.es2025.d.ts'],
};

export const BROWSER: EcmaScriptLevel = {
  target: ts.ScriptTarget.ES2024,
  lib: ['lib.es2024.d.ts', 'lib.dom.d.ts'],
};

const SERVICE_WORKER: EcmaScriptLevel = {
  target: ts.ScriptTarget.ES2024,
  lib: ['lib.es2024.d.ts', 'lib.webworker.d.ts'],
};

interface Tier {
  name: string;
  directories: readonly string[];
  level: EcmaScriptLevel;
}

const TIERS: readonly Tier[] = [
  {
    name: 'server',
    directories: ['apps/server', 'packages/server', 'packages/platform/server'],
    level: SERVER,
  },
  {
    name: 'universal',
    directories: ['packages/universal', 'packages/platform/universal'],
    level: BROWSER,
  },
  {
    name: 'client',
    directories: ['apps/client', 'packages/client', 'packages/platform/client'],
    level: BROWSER,
  },
];

const PRESETS = 'packages/platform/universal/tsconfig';

/** Files whose level is not their tier's, by path. The presets come first: they are the tiers' source. */
const FILES: Readonly<Record<string, EcmaScriptLevel | typeof UNSET>> = {
  [`${PRESETS}/base.json`]: UNSET,
  [`${PRESETS}/build.json`]: UNSET,
  [`${PRESETS}/server.json`]: SERVER,
  [`${PRESETS}/universal.json`]: BROWSER,
  [`${PRESETS}/client.json`]: BROWSER,
  [`${PRESETS}/spec.json`]: BROWSER,
  'tsconfig.base.json': UNSET,
  'tsconfig.repo.json': SERVER,
  'apps/client/web/tsconfig.sw.json': SERVICE_WORKER,
  'scripts/__tests__/typecheck-fixtures/tsconfig.json': BROWSER,
};

/** Projects that install the platform from tarballs and own their compiler options, outside any tier. */
const STANDALONE = ['tests/fixtures/'];

export function trackedTsconfigs(): string[] {
  return trackedFiles(':(glob)**/tsconfig*.json').filter(
    (file) => !STANDALONE.some((prefix) => file.startsWith(prefix))
  );
}

/** What a tracked tsconfig must resolve to, or `undefined` when no tier or file entry claims it. */
export function expectedLevel(file: string): EcmaScriptLevel | typeof UNSET | undefined {
  return (
    FILES[file] ??
    TIERS.find(({ directories }) =>
      directories.some((directory) => file.startsWith(`${directory}/`))
    )?.level
  );
}

const host: ts.ParseConfigFileHost = {
  ...ts.sys,
  readDirectory: () => [],
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  },
};

const NO_INPUTS = 18003;

const TARGET_NAMES = new Map(
  Object.entries(ts.ScriptTarget)
    .filter(([name, value]) => /^ES\d{4}$/.test(name) && typeof value === 'number')
    .map(([name, value]) => [value, name])
);

const targetName = (target: ts.ScriptTarget | undefined): string =>
  target === undefined ? 'unset' : (TARGET_NAMES.get(target) ?? String(target));

interface EffectiveLevel {
  target: ts.ScriptTarget | undefined;
  lib: readonly string[] | undefined;
  problems: string[];
}

/** The `target` and `lib` a tsconfig resolves to once its `extends` chain is applied, by the compiler's own parser. */
function effectiveLevel(file: string, root = ROOT): EffectiveLevel {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(root, file), {}, host);
  const { target, lib } = parsed?.options ?? {};
  return {
    target,
    lib: lib === undefined ? undefined : lib.toSorted(),
    problems: (parsed?.errors ?? [])
      .filter(({ code }) => code !== NO_INPUTS)
      .map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n')),
  };
}

/** One line per way the resolved level departs from the expected one; empty when they agree. */
export function levelDifferences(
  file: string,
  expected: EcmaScriptLevel | typeof UNSET,
  root = ROOT
): string[] {
  const { target, lib, problems } = effectiveLevel(file, root);
  const wanted =
    expected === UNSET
      ? { target: undefined, lib: undefined }
      : { target: expected.target, lib: expected.lib.toSorted() };
  const libNames = (names: readonly string[] | undefined) => (names ? `[${names}]` : 'unset');
  return [
    ...problems.map((problem) => `${file}: ${problem}`),
    ...(target === wanted.target
      ? []
      : [`${file}: target ${targetName(target)}, expected ${targetName(wanted.target)}`]),
    ...(lib?.join() === wanted.lib?.join()
      ? []
      : [`${file}: lib ${libNames(lib)}, expected ${libNames(wanted.lib)}`]),
  ];
}
