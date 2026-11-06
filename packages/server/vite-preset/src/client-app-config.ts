import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BundleRules, bundleGuard } from '@vp/vite-preset/bundle-guard';
import { type ReactCompiler, reactPlugins } from '@vp/vite-preset/react-plugins';
import { type Alias, defineConfig, type PluginOption, type SSROptions } from 'vite';

// Vite loads an app's config with this package external, and Node cannot resolve an extensionless
// relative import between two of its source files: the bundle guard and the React plugins are reached
// by their package subpaths.

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

const VENDOR_CHUNKS = {
  react: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-compiler-runtime)[\\/]/,
  tanstack:
    /[\\/]node_modules[\\/]@tanstack[\\/](react-router|router-core|history|react-store|store|react-query|query-core|react-table|table-core|pacer-lite|devtools-event-client)[\\/]/,
  dnd: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
  forms:
    /[\\/]node_modules[\\/](@tanstack[\\/](react-form|form-core)|react-dropzone|file-selector|attr-accept)[\\/]/,
  player: /[\\/]node_modules[\\/](hls\.js|@videojs)[\\/]/,
  charts:
    /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|es-toolkit|decimal\.js-light|@reduxjs|redux|immer|reselect)[\\/]/,
};

const VENDOR_GROUPS = Object.entries(VENDOR_CHUNKS).map(([name, test], index, all) => ({
  name: `vendor-${name}`,
  test,
  priority: all.length - index,
  includeDependenciesRecursively: true,
}));

/** The long-lived vendor chunk a module belongs to, so its hash survives an app deploy. */
export function vendorChunkOf(moduleId: string): string | null {
  return VENDOR_GROUPS.find(({ test }) => test.test(moduleId))?.name ?? null;
}

export type ClientAppOptions = BundleRules & {
  /** Routes rendered to static HTML at build time, into the client output, for a service worker to precache. */
  prerender?: readonly string[];
  /** The `import.meta.url` of the app's `vite.config.ts`. */
  configUrl: string;
  port: number;
  /** Plugins the app adds after the preset's own, such as its service worker's; never called under test. */
  plugins?: () => PluginOption[] | Promise<PluginOption[]>;
  compiler?: ReactCompiler;
};

// Vitest loads every project's config even when it runs another project; the Start plugin's
// config hook then crawls routes in the background of that run. Specs use the committed tree.
async function appPlugins(
  mode: string,
  rules: BundleRules,
  prerender: readonly string[],
  compiler: ReactCompiler | undefined,
  extra: () => PluginOption[] | Promise<PluginOption[]>
): Promise<PluginOption[]> {
  if (mode === 'test') return reactPlugins(compiler);
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
    ...reactPlugins(compiler),
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
  compiler,
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
      plugins: await appPlugins(mode, rules, prerender, compiler, plugins),
    };
  });
}
