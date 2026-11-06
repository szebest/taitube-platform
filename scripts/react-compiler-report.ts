import { glob, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compilerDiagnostics } from '../packages/server/vite-preset/src/react-plugins';

const SOURCES = ['apps/client/*/src/**/*.{ts,tsx}', 'packages/client/*/src/**/*.{ts,tsx}'];
const SKIPPED = ['**/__tests__/**', '**/*.d.ts', '**/routeTree.gen.ts'];
const BASELINE = 'tests/react-compiler/baseline.json';

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

if (failures.length > 0) {
  process.stderr.write(`react-compiler-report: ${failures.length} not in the baseline\n`);
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`react-compiler-report: ${files.length} files, every bailout in the baseline\n`);
}
