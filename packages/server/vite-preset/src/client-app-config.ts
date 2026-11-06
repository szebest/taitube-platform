import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import viteReact from '@vitejs/plugin-react';
import { type Alias, defineConfig, type Plugin, type PluginOption, type SSROptions } from 'vite';

// One module on purpose: Vite loads an app's config with this package external, and Node cannot
// resolve an extensionless relative import between two of its source files.

const PACKAGES_DIR = fileURLToPath(new URL('../../..', import.meta.url));
const BROWSER_TIERS = ['universal', 'client'];

type ExportTarget = string | { import?: string };

type PackageManifest = {
  name: string;
  exports?: Record<string, ExportTarget>;
};

function importTarget(target: ExportTarget): string | undefined {
  return typeof target === 'string' ? target : target.import;
}

/** The source a built file comes from: `./dist/time.js` is `./src/time.ts`. */
function sourceOf(built: string): string {
  const inSrc = built.startsWith('./dist/') ? `./src/${built.slice('./dist/'.length)}` : built;
  return inSrc.endsWith('.js') ? `${inSrc.slice(0, -'.js'.length)}.ts` : inSrc;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type SourceExport = { specifier: string; source: string };

type SourceAlias = Alias & { find: RegExp };

function wildcardDirectory(source: string): string {
  const head = source.slice(0, source.indexOf('*'));
  return head.endsWith('/') ? head : dirname(head);
}

function sourceExports(packageDir: string): SourceExport[] {
  const { name, exports = {} }: PackageManifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  );
  return Object.entries(exports).flatMap(([subpath, target]) => {
    const built = importTarget(target);
    if (built === undefined) return [];
    const source = join(packageDir, sourceOf(built));
    const existing = source.includes('*') ? wildcardDirectory(source) : source;
    if (!existsSync(existing)) {
      throw new Error(`${name} exports ${subpath} from ${built}, which has no source at ${source}`);
    }
    return [
      { specifier: subpath === '.' ? name : `${name}/${subpath.slice('./'.length)}`, source },
    ];
  });
}

/** Node prefers an exact key, then the pattern with the longest prefix; Vite takes the first alias. */
function byNodePrecedence(a: SourceExport, b: SourceExport): number {
  return (
    b.specifier.indexOf('*') - a.specifier.indexOf('*') || b.specifier.length - a.specifier.length
  );
}

function toAlias({ specifier, source }: SourceExport): SourceAlias {
  return {
    find: new RegExp(`^${specifier.split('*').map(escapeRegExp).join('(.+)')}$`),
    replacement: source.replaceAll('*', '$1'),
  };
}

/**
 * Points each browser-tier package's exports at their TypeScript source, so the dev server, the
 * build and the specs read the code itself, with HMR, instead of a `dist` a build must refresh.
 * A package with no `src` is one the app does not use: an image build installs from every app's
 * pruned manifests but copies only this app's sources.
 */
export function workspaceSourceAliases(packagesDir: string): SourceAlias[] {
  const exports = BROWSER_TIERS.flatMap((tier) =>
    readdirSync(join(packagesDir, tier))
      .map((dir) => join(packagesDir, tier, dir))
      .filter((packageDir) => existsSync(join(packageDir, 'src')))
      .flatMap(sourceExports)
  );
  const patterns = exports.filter(({ specifier }) => specifier.includes('*'));
  const exact = exports.filter(({ specifier }) => !specifier.includes('*'));
  return [...exact, ...patterns.sort(byNodePrecedence)].map(toAlias);
}

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

const VENDOR_CHUNKS = {
  react: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-compiler-runtime)[\\/]/,
  tanstack: /[\\/]node_modules[\\/]@tanstack[\\/](?!react-virtual|virtual-core|react-form|form-core)/,
  dnd: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
  forms: /[\\/]node_modules[\\/](@tanstack[\\/](react-form|form-core)|react-dropzone|file-selector|attr-accept)[\\/]/,
  player: /[\\/]node_modules[\\/](hls\.js|@videojs)[\\/]/,
  charts:
    /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|es-toolkit|decimal\.js-light|@reduxjs|redux|immer|reselect)[\\/]/,
};

const VENDOR_GROUPS = Object.entries(VENDOR_CHUNKS).map(([name, test], index, all) => ({
  name: `vendor-${name}`,
  test,
  priority: all.length - index,
  includeDependenciesRecursively: false,
}));

/** The long-lived vendor chunk a module belongs to, so its hash survives an app deploy. */
export function vendorChunkOf(moduleId: string): string | null {
  return VENDOR_GROUPS.find(({ test }) => test.test(moduleId))?.name ?? null;
}

const LAZY_VENDOR_CHUNKS = ['vendor-player', 'vendor-charts'];

function initialLazyVendors(chunks: readonly BundledChunk[]): string[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const seen = new Set<string>();
  const pending = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
  for (const name of pending) {
    if (seen.has(name)) continue;
    seen.add(name);
    pending.push(...(byName.get(name)?.imports ?? []));
  }
  return [...seen]
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
  ];
  const split = chunks.some((chunk) => !chunk.isEntry && routesIn(chunk).length > 0);
  return split ? violations : [...violations, 'no route was split into a chunk of its own'];
}

/** What the production server bundle must not do: carry the code only the dev server may run. */
export function serverBundleViolations(chunks: readonly BundledChunk[]): string[] {
  return chunks.flatMap((chunk) => devOnlyViolations(chunk));
}

function bundleGuard(rules: BundleRules): Plugin {
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

export type ClientAppOptions = BundleRules & {
  /** Routes rendered to static HTML at build time, into the client output, for a service worker to precache. */
  prerender?: readonly string[];
  /** The `import.meta.url` of the app's `vite.config.ts`. */
  configUrl: string;
  port: number;
  /** Plugins the app adds after the preset's own, such as its service worker's; never called under test. */
  plugins?: () => PluginOption[] | Promise<PluginOption[]>;
};

// Vitest loads every project's config even when it runs another project; the Start plugin's
// config hook then crawls routes in the background of that run. Specs use the committed tree.
async function appPlugins(
  mode: string,
  rules: BundleRules,
  prerender: readonly string[],
  extra: () => PluginOption[] | Promise<PluginOption[]>
): Promise<PluginOption[]> {
  if (mode === 'test') return [viteReact()];
  const [{ tanstackStart }, { default: tailwindcss }] = await Promise.all([
    import('@tanstack/react-start/plugin/vite'),
    import('@tailwindcss/vite'),
  ]);
  return [
    tanstackStart({
      router: { routeFileIgnorePattern: '__tests__', quoteStyle: 'single', semicolons: true },
      ...(prerender.length > 0 && {
        pages: prerender.map((path) => ({ path })),
        prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
      }),
    }),
    viteReact(),
    tailwindcss(),
    bundleGuard(rules),
    ...(await extra()),
  ];
}

/** The Vite config every TanStack Start app under `apps/client/` builds, serves and tests with. */
export function clientAppConfig({
  configUrl,
  port,
  plugins = () => [],
  prerender = [],
  ...rules
}: ClientAppOptions) {
  return defineConfig(async ({ command, mode }) => {
    // A CommonJS dependency a workspace package brings in, inlined next to an external `react`,
    // would `require` it at runtime from an image that ships no node_modules.
    const ssr: SSROptions = command === 'build' ? { noExternal: true } : {};
    return {
      resolve: { alias: workspaceSourceAliases(PACKAGES_DIR) },
      ssr,
      css: {
        preprocessorOptions: {
          scss: { loadPaths: [fileURLToPath(new URL('./src', configUrl))] },
        },
      },
      environments: {
        client: {
          build: {
            rolldownOptions: {
              output: { codeSplitting: { groups: VENDOR_GROUPS } },
            },
          },
        },
      },
      server: { port, strictPort: true },
      preview: { host: '127.0.0.1', port, strictPort: true },
      plugins: await appPlugins(mode, rules, prerender, plugins),
    };
  });
}
