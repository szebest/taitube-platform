import { posix } from 'node:path';
import ts from 'typescript';
import { clientApps } from './client-apps';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

type PerApp = Readonly<Record<string, number>>;

/** Import sites from one feature into another, source and spec; each break lowers its app's number. */
const CROSS_FEATURE: PerApp = { studio: 29, web: 115 };

/** Import sites from `components/`, `hooks/`, `utils/`, `lib/` or `integrations/` into a feature. */
const INTO_FEATURE: PerApp = { studio: 0, web: 4 };

/** Features whose folder has no `index.ts` yet. */
const WITHOUT_INDEX: PerApp = { studio: 10, web: 16 };

const BELOW_FEATURES = new Set(['components', 'hooks', 'utils', 'lib', 'integrations']);

const MOCKS = new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock']);

const OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolvePackageJsonImports: true,
  jsx: ts.JsxEmit.ReactJSX,
};

/** Every module a file names: imports, re-exports, `import()` and its type form, and Vitest's module mocks. */
function specifiers(file: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      found.push(node.argument.literal.text);
    } else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const callee = node.expression;
      const named =
        callee.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === 'vi' &&
          MOCKS.has(callee.name.text));
      if (named && first && ts.isStringLiteralLike(first)) found.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return found;
}

/** Resolves a relative or `#app/` specifier the way the bundler does, over the files `exists` knows. */
function moduleResolver(exists: (file: string) => boolean, readFile: (file: string) => string) {
  const host: ts.ModuleResolutionHost = {
    fileExists: (file) => exists(file.slice(1)),
    readFile: (file) => (exists(file.slice(1)) ? readFile(file.slice(1)) : undefined),
  };
  const cache = ts.createModuleResolutionCache('/', (name) => name, OPTIONS);
  return (from: string, specifier: string): string | undefined => {
    if (!(specifier.startsWith('.') || specifier.startsWith('#'))) return undefined;
    const [path = specifier] = specifier.split('?');
    const { resolvedModule } = ts.resolveModuleName(path, `/${from}`, OPTIONS, host, cache);
    return resolvedModule?.resolvedFileName.slice(1);
  };
}

interface Place {
  app: string;
  layer: string;
  feature: string | undefined;
}

function placeOf(file: string, apps: readonly string[]): Place | undefined {
  const app = apps.find((candidate) => file.startsWith(`${candidate}/src/`));
  if (app === undefined) return undefined;
  const [layer = '', feature, ...rest] = file.slice(`${app}/src/`.length).split('/');
  return {
    app: posix.basename(app),
    layer: feature === undefined ? 'root' : layer,
    feature: layer === 'features' && rest.length > 0 ? feature : undefined,
  };
}

type EdgeKind = 'cross-feature' | 'into-feature';

function edgeKind(from: Place, to: Place): EdgeKind | undefined {
  if (to.layer !== 'features') return undefined;
  if (from.layer === 'features' && from.feature !== to.feature) return 'cross-feature';
  if (BELOW_FEATURES.has(from.layer)) return 'into-feature';
  return undefined;
}

interface Tree {
  files: readonly string[];
  read: (file: string) => string;
}

/** Each forbidden edge of `tree`, one per import site, as `kind app importer -> imported`. */
function forbiddenEdges({ files, read: readFile }: Tree, apps: readonly string[]): string[] {
  const known = new Set(files);
  const resolve = moduleResolver((file) => known.has(file), readFile);
  return files
    .filter((file) => /\.tsx?$/.test(file))
    .flatMap((file) => {
      const from = placeOf(file, apps);
      if (from === undefined) return [];
      return specifiers(file, readFile(file)).flatMap((specifier) => {
        const target = resolve(file, specifier);
        const to = target === undefined ? undefined : placeOf(target, apps);
        const kind = to === undefined ? undefined : edgeKind(from, to);
        return kind === undefined ? [] : [`${kind} ${from.app} ${file} -> ${target}`];
      });
    });
}

function featuresWithoutIndex(files: readonly string[], apps: readonly string[]): string[] {
  const known = new Set(files);
  return apps.flatMap((app) => {
    const root = `${app}/src/features/`;
    const features = new Set(
      files
        .filter((file) => file.startsWith(root))
        .map((file) => file.slice(root.length).split('/'))
        .filter((parts) => parts.length > 1)
        .map(([feature]) => `${root}${feature}`)
    );
    return [...features].filter((feature) => !known.has(`${feature}/index.ts`));
  });
}

function countPerApp(
  lines: readonly string[],
  apps: readonly string[],
  appOf: (line: string) => string
) {
  return Object.fromEntries(
    apps
      .map((app) => posix.basename(app))
      .map((app) => [app, lines.filter((line) => appOf(line) === app).length])
  );
}

const MANIFEST = JSON.stringify({
  imports: {
    '#app/*': ['./src/*', './src/*.ts', './src/*.tsx', './src/*/index.ts', './src/*/index.tsx'],
  },
});

function fixture(sources: Record<string, string>): Tree {
  const files: Record<string, string> = {
    'apps/client/web/package.json': MANIFEST,
    'apps/client/studio/package.json': MANIFEST,
    ...sources,
  };
  return { files: Object.keys(files), read: (file) => files[file] ?? '' };
}

const FIXTURE_APPS = ['apps/client/studio', 'apps/client/web'];

describe('architecture: the layers of a client app import only downwards', () => {
  it.each([
    {
      edge: 'a route into a feature',
      importer: 'apps/client/web/src/routes/index.tsx',
      source: "import { Home } from '#app/features/browse/components/home/home';",
      kind: undefined,
    },
    {
      edge: 'a feature into its own files',
      importer: 'apps/client/studio/src/features/videos/components/library/library.tsx',
      source: "import { Home } from '#app/features/videos/components/home/home';",
      kind: undefined,
    },
    {
      edge: 'a feature into the kit',
      importer: 'apps/client/web/src/features/browse/components/home/home.tsx',
      source: "import { Card } from '#app/components/video/card';",
      kind: undefined,
    },
    {
      edge: 'a feature into another feature, by alias',
      importer: 'apps/client/web/src/features/watch/components/page/page.tsx',
      source: "import { Home } from '#app/features/browse/components/home/home';",
      kind: 'cross-feature',
    },
    {
      edge: 'a feature into another feature, by a relative path',
      importer: 'apps/client/studio/src/features/upload/upload.ts',
      source: "import { Home } from '../videos/components/home/home';",
      kind: 'cross-feature',
    },
    {
      edge: 'a spec of a feature into another feature, through a mock',
      importer: 'apps/client/studio/src/features/upload/__tests__/upload.test.ts',
      source: "vi.mock(import('#app/features/videos/components/home/home'));",
      kind: 'cross-feature',
    },
    {
      edge: 'the kit into a feature',
      importer: 'apps/client/web/src/components/video/card/card.tsx',
      source: "import { Home } from '#app/features/browse/components/home/home';",
      kind: 'into-feature',
    },
    {
      edge: 'lib into a feature',
      importer: 'apps/client/studio/src/lib/config/index.ts',
      source: "export { Home } from '#app/features/videos/components/home/home';",
      kind: 'into-feature',
    },
  ])('reads $edge as $kind', ({ importer, source, kind }) => {
    const tree = fixture({
      [importer]: source,
      'apps/client/web/src/features/browse/components/home/home.tsx': '',
      'apps/client/studio/src/features/videos/components/home/home.tsx': '',
      'apps/client/web/src/components/video/card/index.ts': '',
    });

    expect(forbiddenEdges(tree, FIXTURE_APPS).map((edge) => edge.split(' ')[0])).toEqual(
      kind === undefined ? [] : [kind]
    );
  });

  it('finds a feature with no index.ts, on either app', () => {
    const files = fixture({
      'apps/client/web/src/features/browse/index.ts': '',
      'apps/client/web/src/features/browse/api/feed.ts': '',
      'apps/client/studio/src/features/videos/api/library.ts': '',
    }).files;

    expect(featuresWithoutIndex(files, FIXTURE_APPS)).toEqual([
      'apps/client/studio/src/features/videos',
    ]);
  });

  describe('over the tree', () => {
    const apps = clientApps();
    const files = trackedFiles(...apps.map((app) => `${app}/`));
    const edges = forbiddenEdges({ files, read }, apps);
    const appOfEdge = (edge: string) => edge.split(' ')[1] ?? '';

    it.each([
      { rule: 'cross-feature', expected: CROSS_FEATURE },
      { rule: 'into-feature', expected: INTO_FEATURE },
    ])('holds the $rule import sites at their number per app', ({ rule, expected }) => {
      const sites = edges.filter((edge) => edge.startsWith(`${rule} `));

      expect(countPerApp(sites, apps, appOfEdge)).toEqual(expected);
    });

    it('holds the features with no index.ts at their number per app', () => {
      const missing = featuresWithoutIndex(files, apps);

      expect(countPerApp(missing, apps, (feature) => feature.split('/')[2] ?? '')).toEqual(
        WITHOUT_INDEX
      );
    });
  });
});
