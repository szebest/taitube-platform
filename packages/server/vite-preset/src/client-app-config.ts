import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import viteReact from '@vitejs/plugin-react';
import { type Alias, type Plugin, type PluginOption, type SSROptions, defineConfig } from 'vite';

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

function sourceAliases(packageDir: string): Alias[] {
  const { name, exports = {} }: PackageManifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  );
  return Object.entries(exports).flatMap(([subpath, target]) => {
    const built = importTarget(target);
    if (built === undefined) return [];
    const source = join(packageDir, sourceOf(built));
    if (!existsSync(source)) {
      throw new Error(`${name} exports ${subpath} from ${built}, which has no source at ${source}`);
    }
    const specifier = subpath === '.' ? name : `${name}/${subpath.slice('./'.length)}`;
    return [{ find: new RegExp(`^${specifier}$`), replacement: source }];
  });
}

/**
 * Points each browser-tier package's exports at their TypeScript source, so the dev server, the
 * build and the specs read the code itself, with HMR, instead of a `dist` a build must refresh.
 */
export function workspaceSourceAliases(packagesDir: string): Alias[] {
  return BROWSER_TIERS.flatMap((tier) =>
    readdirSync(join(packagesDir, tier))
      .map((dir) => join(packagesDir, tier, dir))
      .filter((packageDir) => existsSync(join(packageDir, 'package.json')))
      .flatMap(sourceAliases)
  );
}

export interface BundledChunk {
  fileName: string;
  isEntry: boolean;
  moduleIds: readonly string[];
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

function chunkViolations(chunk: BundledChunk, devOnlyDirs: readonly string[]): string[] {
  const devOnly = [
    ...DEVTOOLS.filter((name) => carries(chunk, `/node_modules/${name}/`)),
    ...devOnlyDirs.filter((dir) => carries(chunk, `/${dir}/`)),
  ];
  const routes = routesIn(chunk);
  return [
    ...devOnly.map(
      (name) => `${chunk.fileName} carries ${name}, which only the dev server may load`
    ),
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
 * What a production client bundle must not do: ship devtools or a directory the app keeps to its dev
 * server, stop splitting per route, or read the server's environment (`SSR_API_BASE_URL` is read
 * behind `import.meta.env.SSR`, which the build drops).
 */
export function bundleViolations(
  chunks: readonly BundledChunk[],
  devOnlyDirs: readonly string[]
): string[] {
  const violations = chunks.flatMap((chunk) => chunkViolations(chunk, devOnlyDirs));
  const split = chunks.some((chunk) => !chunk.isEntry && routesIn(chunk).length > 0);
  return split ? violations : [...violations, 'no route was split into a chunk of its own'];
}

function bundleGuard(devOnlyDirs: readonly string[]): Plugin {
  return {
    name: 'vp:bundle-guard',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [
              {
                fileName: output.fileName,
                isEntry: output.isEntry,
                moduleIds: output.moduleIds,
                code: output.code,
              },
            ]
          : []
      );
      const violations = bundleViolations(chunks, devOnlyDirs);
      if (violations.length > 0) this.error(violations.join('\n'));
    },
  };
}

export type ClientAppOptions = {
  /** The `import.meta.url` of the app's `vite.config.ts`. */
  configUrl: string;
  port: number;
  /** Directories of the app, such as `src/features/design-system`, that only the dev server may load. */
  devOnlyDirs?: readonly string[];
};

// Vitest loads every project's config even when it runs another project; the Start plugin's
// config hook then crawls routes in the background of that run. Specs use the committed tree.
async function appPlugins(mode: string, devOnlyDirs: readonly string[]): Promise<PluginOption[]> {
  if (mode === 'test') return [viteReact()];
  const [{ tanstackStart }, { default: tailwindcss }] = await Promise.all([
    import('@tanstack/react-start/plugin/vite'),
    import('@tailwindcss/vite'),
  ]);
  return [
    tanstackStart({
      router: { routeFileIgnorePattern: '__tests__', quoteStyle: 'single', semicolons: true },
    }),
    viteReact(),
    tailwindcss(),
    bundleGuard(devOnlyDirs),
  ];
}

/** The Vite config every TanStack Start app under `apps/client/` builds, serves and tests with. */
export function clientAppConfig({ configUrl, port, devOnlyDirs = [] }: ClientAppOptions) {
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
      server: { port, strictPort: true },
      preview: { port, strictPort: true },
      plugins: await appPlugins(mode, devOnlyDirs),
    };
  });
}
