import { spawnSync } from 'node:child_process';
import { glob, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compilerDiagnostics } from '../packages/server/vite-preset/src/react-plugins';

const SOURCES = ['apps/client/*/src/**/*.{ts,tsx}', 'packages/client/*/src/**/*.{ts,tsx}'];
const SKIPPED = ['**/__tests__/**', '**/*.d.ts', '**/routeTree.gen.ts'];
const BASELINE = 'tests/react-compiler/baseline.json';
const VP = join(import.meta.dirname, '../node_modules/.bin/vp');
const UNBASELINED_CONFIG = join(import.meta.dirname, '../tests/react-compiler/vite.config.ts');

type BaselineEntry = {
  /** The compiler categories the file may report, each one a function the build leaves uncompiled. */
  bailouts: string[];
  /** The oxlint compiler rules `lint.config.ts` turns off for the file. */
  lint: string[];
  reason: string;
  issue: string;
};

const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));
const baseline: Record<string, BaselineEntry> = JSON.parse(
  await readFile(join(root, BASELINE), 'utf8')
);

const files: string[] = [];
for await (const file of glob(SOURCES, { cwd: root, exclude: SKIPPED })) {
  files.push(file);
}
files.sort();

const reports = await Promise.all(
  files.map(async (file) => ({
    file,
    diagnostics: await compilerDiagnostics(file, await readFile(join(root, file), 'utf8')),
  }))
);

const failures = reports.flatMap(({ file, diagnostics }) => {
  const allowed = baseline[file]?.bailouts ?? [];
  const found = new Set(diagnostics.map(({ category }) => category));
  return [
    ...diagnostics
      .filter(({ category }) => !allowed.includes(category))
      .map(({ line, category, message }) => `${file}:${line} ${category}: ${message}`),
    ...allowed
      .filter((category) => !found.has(category))
      .map((category) => `${file}: ${category} no longer bails, remove it from ${BASELINE}`),
  ];
});

/** `react-hooks(exhaustive-deps)` and `react/exhaustive-deps` name one rule: compare what follows the plugin. */
const ruleName = (rule: string) => rule.slice(rule.search(/[/(]/) + 1).replace(')', '');

function firingRules(lintedFiles: string[]): Map<string, Set<string>> {
  const lint = spawnSync(VP, ['lint', '-c', UNBASELINED_CONFIG, '-f', 'json', ...lintedFiles], {
    cwd: root,
    encoding: 'utf8',
  });
  if (!lint.stdout.includes('{')) {
    throw new Error(`vp lint gave no report: ${lint.stderr || lint.stdout}`);
  }
  const { diagnostics }: { diagnostics: { code: string; filename: string }[] } = JSON.parse(
    lint.stdout.slice(lint.stdout.indexOf('{'))
  );
  const firing = new Map<string, Set<string>>();
  for (const { code, filename } of diagnostics) {
    firing.set(filename, (firing.get(filename) ?? new Set()).add(ruleName(code)));
  }
  return firing;
}

const lintEntries = Object.entries(baseline).filter(([, { lint }]) => lint.length > 0);
const firing = lintEntries.length > 0 ? firingRules(lintEntries.map(([file]) => file)) : new Map();
failures.push(
  ...lintEntries.flatMap(([file, { lint }]) =>
    lint
      .filter((rule) => !firing.get(file)?.has(ruleName(rule)))
      .map((rule) => `${file}: ${rule} no longer fires, remove it from ${BASELINE}`)
  )
);

if (failures.length > 0) {
  process.stderr.write(`react-compiler-report: ${failures.length} not in the baseline\n`);
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`react-compiler-report: ${files.length} files, every bailout in the baseline\n`);
}
