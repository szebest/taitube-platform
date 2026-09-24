import { dirname, join } from 'node:path';
import ts from 'typescript';
import { ROOT, productionSources } from './repo-files';
import { workspaceSources } from './workspace-sources';

function workspacePaths(): Record<string, string[]> {
  return Object.fromEntries(
    workspaceSources().flatMap(({ name, root, src }) => [
      [name, [join(src, 'index.ts')]],
      [`${name}/*`, [join(src, '*'), join(root, '*')]],
    ])
  );
}

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  /**
   * No DOM: `lib.dom.d.ts` is most of what the program parses, and none of the assertions asks about a
   * browser global. In `apps/web` one reads as an error type, which is not a `Result` or a config leaf.
   */
  lib: ['lib.es2022.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  baseUrl: ROOT,
  paths: workspacePaths(),
};

export interface SharedProgram {
  program: ts.Program;
  /** The files the program was built over, as the checker names them. */
  roots: ReadonlySet<string>;
}

let shared: SharedProgram | undefined;

const LIB_DIR = dirname(ts.getDefaultLibFilePath(OPTIONS));
const libSources = new Map<string, ts.SourceFile>();

/** The `lib.*.d.ts` files, parsed once per process: every fixture program would parse them again. */
function libSource(file: string, version: ts.ScriptTarget): ts.SourceFile | undefined {
  if (!file.startsWith(LIB_DIR)) return undefined;
  let source = libSources.get(file);
  if (!source) {
    const text = ts.sys.readFile(file);
    if (text === undefined) return undefined;
    source = ts.createSourceFile(file, text, version, true);
    libSources.set(file, source);
  }
  return source;
}

/**
 * Only this repo's modules and Fastify resolve: a third-party import reads as `any`, which keeps the
 * SDK declarations out of the program. Fastify stays, because `app.config` is typed by augmenting it.
 */
function workspaceOnlyHost(): ts.CompilerHost {
  const host = ts.createCompilerHost(OPTIONS);
  const resolutions = ts.createModuleResolutionCache(ROOT, (name) => name, OPTIONS);
  const parse = host.getSourceFile.bind(host);
  host.getSourceFile = (file, version, ...rest) =>
    libSource(file, ts.ScriptTarget.ES2022) ?? parse(file, version, ...rest);
  host.resolveModuleNameLiterals = (literals, containingFile, redirected, options) =>
    literals.map(({ text }) =>
      text.startsWith('.') || text.startsWith('@vp/') || text === 'fastify'
        ? ts.resolveModuleName(text, containingFile, options, host, resolutions, redirected)
        : { resolvedModule: undefined }
    );
  return host;
}

/**
 * Every production source, the browser tier included, in one program the type-aware assertions
 * share: building one per test file is what would put the suite over its time budget.
 */
export function productionProgram(): SharedProgram {
  if (shared) return shared;

  const roots = productionSources().map((file) => join(ROOT, file));
  shared = {
    program: ts.createProgram(roots, OPTIONS, workspaceOnlyHost()),
    roots: new Set(roots),
  };
  return shared;
}

const fixturePrograms = new Map<string, ts.Program>();

/** Built once per set of files: a new program binds the whole `lib` again before it checks a line. */
export function fixtureProgram(files: Record<string, string>): ts.Program {
  const key = JSON.stringify(files);
  let program = fixturePrograms.get(key);
  if (!program) {
    program = buildFixtureProgram(files);
    fixturePrograms.set(key, program);
  }
  return program;
}

function buildFixtureProgram(files: Record<string, string>): ts.Program {
  const host = ts.createCompilerHost(OPTIONS);
  const read = host.readFile.bind(host);
  host.readFile = (file) => files[file] ?? read(file);
  host.fileExists = (file) => Object.hasOwn(files, file) || ts.sys.fileExists(file);
  host.directoryExists = (dir) =>
    Object.keys(files).some((file) => file.startsWith(`${dir}/`)) || ts.sys.directoryExists(dir);
  host.getSourceFile = (file, version) => {
    const lib = files[file] === undefined ? libSource(file, ts.ScriptTarget.ES2022) : undefined;
    if (lib) return lib;
    const text = files[file] ?? ts.sys.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, version, true);
  };
  return ts.createProgram(Object.keys(files), { ...OPTIONS, paths: {} }, host);
}
