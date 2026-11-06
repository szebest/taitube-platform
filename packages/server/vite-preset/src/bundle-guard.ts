import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

export interface BundledChunk {
  fileName: string;
  isEntry: boolean;
  moduleIds: readonly string[];
  imports: readonly string[];
  code: string;
}

const DEVTOOLS = [
  '@tanstack/react-router-devtools',
  '@tanstack/react-query-devtools',
  '@tanstack/router-devtools-core',
  '@tanstack/query-devtools',
];
const SERVER_ENVIRONMENT = /\bprocess\.env\b/;
const ROUTE_SPLIT = /\/(src\/routes\/[^?]+)\?tsr-split=/;

function routesIn(chunk: BundledChunk): string[] {
  const routes = chunk.moduleIds.flatMap((id) => ROUTE_SPLIT.exec(id)?.[1] ?? []);
  return [...new Set(routes)].sort();
}

function carries(chunk: BundledChunk, pathPart: string): boolean {
  return chunk.moduleIds.some((id) => id.includes(pathPart));
}

export type BundleRules = {
  /** Gzip kilobytes an entry chunk may weigh. */
  entryBudgetKb?: number;
  /** Gzip kilobytes of every chunk the entries import statically, the first load of any page. */
  initialBudgetKb?: number;
  /** Directories of the app no chunk may carry at all: code that moved to another app. */
  forbiddenDirs?: readonly string[];
};

/** A package's development-only modules, such as `@vp/queries/dev-personas`, live in a `dev-only/` folder. */
const DEV_ONLY_FOLDER = 'dev-only/';

function devOnlyViolations(chunk: BundledChunk): string[] {
  const devOnly = [
    ...DEVTOOLS.filter((name) => carries(chunk, `/node_modules/${name}/`)),
    ...(carries(chunk, `/${DEV_ONLY_FOLDER}`) ? [DEV_ONLY_FOLDER] : []),
  ];
  return devOnly.map(
    (name) => `${chunk.fileName} carries ${name}, which only the dev server may load`
  );
}

function gzipKb(code: string): number {
  return gzipSync(code).length / 1024;
}

function budgetViolations(chunk: BundledChunk, budgetKb: number | undefined): string[] {
  if (budgetKb === undefined || !chunk.isEntry) return [];
  const size = gzipKb(chunk.code);
  return size > budgetKb
    ? [`${chunk.fileName} is ${size.toFixed(1)} KB gzip, over the ${budgetKb} KB entry budget`]
    : [];
}

function duplicatedModules(chunks: readonly BundledChunk[]): string[] {
  const owners = new Map<string, string[]>();
  for (const chunk of chunks) {
    for (const id of chunk.moduleIds.filter((moduleId) => moduleId.includes('/node_modules/'))) {
      owners.set(id, [...(owners.get(id) ?? []), chunk.fileName]);
    }
  }
  return [...owners]
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => `${id} is bundled into ${files.join(' and ')}`);
}

const LAZY_VENDOR_CHUNKS = ['vendor-player', 'vendor-charts'];

function initialChunks(chunks: readonly BundledChunk[]): BundledChunk[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const seen = new Set<string>();
  const pending = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
  for (const name of pending) {
    if (seen.has(name)) continue;
    seen.add(name);
    pending.push(...(byName.get(name)?.imports ?? []));
  }
  return [...seen].flatMap((name) => byName.get(name) ?? []);
}

function initialLoadViolations(chunks: readonly BundledChunk[], budgetKb: number | undefined) {
  if (budgetKb === undefined) return [];
  const size = initialChunks(chunks).reduce((total, chunk) => total + gzipKb(chunk.code), 0);
  return size > budgetKb
    ? [`the initial load is ${size.toFixed(1)} KB gzip, over the ${budgetKb} KB budget`]
    : [];
}

function initialLazyVendors(chunks: readonly BundledChunk[]): string[] {
  return initialChunks(chunks)
    .map((chunk) => chunk.fileName)
    .filter((name) => LAZY_VENDOR_CHUNKS.some((vendor) => name.startsWith(`assets/${vendor}-`)))
    .map((name) => `${name} loads with the entry, though only the route that needs it may load it`);
}

function chunkViolations(chunk: BundledChunk, rules: BundleRules): string[] {
  const forbidden = (rules.forbiddenDirs ?? []).filter((dir) => carries(chunk, `/${dir}/`));
  const routes = routesIn(chunk);
  return [
    ...devOnlyViolations(chunk),
    ...budgetViolations(chunk, rules.entryBudgetKb),
    ...forbidden.map((dir) => `${chunk.fileName} carries ${dir}, which this app no longer ships`),
    ...(chunk.isEntry
      ? routes.map((route) => `${chunk.fileName} is an entry chunk but carries the route ${route}`)
      : []),
    ...(routes.length > 1 ? [`${chunk.fileName} carries two routes: ${routes.join(', ')}`] : []),
    ...(SERVER_ENVIRONMENT.test(chunk.code)
      ? [`${chunk.fileName} reads the server environment, which only the SSR server has`]
      : []),
  ];
}

/**
 * What a production client bundle must not do: ship devtools or a `dev-only/` folder, carry a directory
 * whose code moved to another app, stop splitting per route, or read the server's
 * environment (`SSR_API_BASE_URL` is read behind `import.meta.env.SSR`, which the build drops).
 */
export function bundleViolations(chunks: readonly BundledChunk[], rules: BundleRules): string[] {
  const violations = [
    ...chunks.flatMap((chunk) => chunkViolations(chunk, rules)),
    ...duplicatedModules(chunks),
    ...initialLazyVendors(chunks),
    ...initialLoadViolations(chunks, rules.initialBudgetKb),
  ];
  const split = chunks.some((chunk) => !chunk.isEntry && routesIn(chunk).length > 0);
  return split ? violations : [...violations, 'no route was split into a chunk of its own'];
}

/** What the production server bundle must not do: carry the code only the dev server may run. */
export function serverBundleViolations(chunks: readonly BundledChunk[]): string[] {
  return chunks.flatMap((chunk) => devOnlyViolations(chunk));
}

export function bundleGuard(rules: BundleRules): Plugin {
  return {
    name: 'vp:bundle-guard',
    apply: 'build',
    applyToEnvironment: (environment) => ['client', 'ssr'].includes(environment.name),
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [
              {
                fileName: output.fileName,
                isEntry: output.isEntry,
                moduleIds: output.moduleIds,
                imports: output.imports,
                code: output.code,
              },
            ]
          : []
      );
      const violations =
        this.environment.name === 'client'
          ? bundleViolations(chunks, rules)
          : serverBundleViolations(chunks);
      if (violations.length > 0) this.error(violations.join('\n'));
    },
  };
}
