import { posix } from 'node:path';
import ts from 'typescript';
import { clientApps } from './client-apps';
import { parseSource } from './parsed-sources';
import { productionSources, read, trackedFiles } from './repo-files';

const BARREL = 'packages/client/components/src/index.ts';
const PACKAGE = '@vp/components';

const isTypeOnly = (node: ts.Node) =>
  ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);

const exported = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

/** A module's source, or `undefined` where there is no such file. */
type ReadModule = (file: string) => string | undefined;

/** The file a relative specifier names, as the bundler resolves it, with its source. */
function resolveModule(from: string, specifier: string, readModule: ReadModule) {
  const base = posix.join(posix.dirname(from), specifier);
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]
    .map((file) => ({ file, source: readModule(file) }))
    .find(({ source }) => source !== undefined);
}

/** The value names a module exports, following `export *` through the files `readModule` finds. */
function valueExports(file: string, source: string, readModule: ReadModule): string[] {
  const sourceFile = parseSource(file, source);
  return sourceFile.statements.flatMap((statement): string[] => {
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return [];
      const target = statement.moduleSpecifier;
      if (!statement.exportClause && target && ts.isStringLiteral(target)) {
        const next = resolveModule(file, target.text, readModule);
        return next?.source === undefined ? [] : valueExports(next.file, next.source, readModule);
      }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        return statement.exportClause.elements
          .filter((element) => !element.isTypeOnly)
          .map((element) => element.name.text);
      }
      return [];
    }
    if (!exported(statement) || isTypeOnly(statement)) return [];
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) =>
        declaration.name.getText()
      );
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name)
      return [statement.name.text];
    return [];
  });
}

/** Each component the barrel re-exports, by its folder, with the value names it brings. */
function components(readModule: ReadModule): Map<string, string[]> {
  const barrel = parseSource(BARREL, readModule(BARREL) ?? '');
  const found = new Map<string, string[]>();
  for (const statement of barrel.statements) {
    const target = ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined;
    const component =
      target && ts.isStringLiteral(target) && resolveModule(BARREL, target.text, readModule);
    if (target && ts.isStringLiteral(target) && component && component.source !== undefined) {
      found.set(target.text, valueExports(component.file, component.source, readModule));
    }
  }
  return found;
}

/** The value names `sources` import from `@vp/components`, by their exported name. */
function importedNames(sources: readonly { file: string; source: string }[]): Set<string> {
  const names = new Set<string>();
  for (const { file, source } of sources) {
    for (const statement of parseSource(file, source).statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === PACKAGE &&
        !statement.importClause?.isTypeOnly
      ) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            if (!element.isTypeOnly) names.add((element.propertyName ?? element.name).text);
          }
        }
      }
    }
  }
  return names;
}

/** Every component one app or none imports, with the apps that do not. */
function appOnly(
  shared: ReadonlyMap<string, readonly string[]>,
  importsByApp: ReadonlyMap<string, ReadonlySet<string>>
): string[] {
  return [...shared].flatMap(([component, names]) => {
    const missing = [...importsByApp]
      .filter(([, imported]) => !names.some((name) => imported.has(name)))
      .map(([app]) => app);
    return missing.length === 0 ? [] : [`${component} (${names.join(', ')}): not in ${missing}`];
  });
}

describe('architecture: @vp/components holds only what both apps render', () => {
  it('reads each component of the barrel, through a nested export *, values only', () => {
    const planted: Record<string, string> = {
      [BARREL]: "export * from './states/empty-state';\nexport * from './illustrations';",
      'packages/client/components/src/states/empty-state/index.ts':
        "export const EmptyState = {};\nexport { useEmptyState } from './ctx';\nexport type { EmptyStateSize } from './types';",
      'packages/client/components/src/illustrations/index.ts': "export * from './illustrations';",
      'packages/client/components/src/illustrations/illustrations.tsx':
        'export function EmptyIllustration() {}\nexport interface IllustrationProps {}',
    };

    expect(components((file) => planted[file])).toEqual(
      new Map([
        ['./states/empty-state', ['EmptyState', 'useEmptyState']],
        ['./illustrations', ['EmptyIllustration']],
      ])
    );
  });

  it('fires on a component only web imports', () => {
    const shared = new Map([
      ['./page-header', ['PageHeader', 'PageHeaderSkeleton']],
      ['./states/error-state', ['ErrorState']],
    ]);
    const importsByApp = new Map([
      [
        'apps/client/web',
        importedNames([
          {
            file: 'a.tsx',
            source: "import { ErrorState, PageHeader as Header } from '@vp/components';",
          },
        ]),
      ],
      [
        'apps/client/studio',
        importedNames([
          { file: 'b.tsx', source: "import { ErrorState } from '@vp/components';" },
          { file: 'c.tsx', source: "import type { PageHeader } from '@vp/components';" },
        ]),
      ],
    ]);

    expect(appOnly(shared, importsByApp)).toEqual([
      './page-header (PageHeader, PageHeaderSkeleton): not in apps/client/studio',
    ]);
  });

  it('finds every component imported by both apps', () => {
    const sources = productionSources();
    const importsByApp = new Map(
      clientApps().map((app) => [
        app,
        importedNames(
          sources
            .filter((file) => file.startsWith(`${app}/src/`))
            .map((file) => ({ file, source: read(file) }))
        ),
      ])
    );

    const tracked = new Set(trackedFiles('packages/client/components/src'));
    const readTracked = (file: string) => (tracked.has(file) ? read(file) : undefined);

    expect(appOnly(components(readTracked), importsByApp)).toEqual([]);
  });
});
