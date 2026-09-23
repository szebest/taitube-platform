import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { ROOT, trackedFiles } from './repo-files';

/**
 * `@vp/*` mapped to source, so a type-aware assertion needs no build: `lint-typecheck` runs this
 * suite before anything is compiled.
 */
function workspacePaths(): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const manifest of trackedFiles('packages').filter((f) =>
    /^packages\/\w+\/[\w-]+\/package\.json$/.test(f)
  )) {
    const dir = dirname(manifest);
    const { name } = JSON.parse(readFileSync(join(ROOT, manifest), 'utf8')) as { name: string };
    const src = existsSync(join(ROOT, dir, 'src')) ? `${dir}/src` : dir;
    paths[name] = [`${src}/index.ts`];
    paths[`${name}/*`] = [`${src}/*`, `${dir}/*`];
  }
  return paths;
}

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  baseUrl: ROOT,
  paths: workspacePaths(),
};

let shared: ts.Program | undefined;

/**
 * Only this repo's modules and Fastify resolve: a third-party import reads as `any`, which keeps the
 * SDK declarations out of the program. Fastify stays, because `app.config` is typed by augmenting it.
 */
function workspaceOnlyHost(): ts.CompilerHost {
  const host = ts.createCompilerHost(OPTIONS);
  host.resolveModuleNameLiterals = (literals, containingFile, redirected, options) =>
    literals.map(({ text }) =>
      text.startsWith('.') || text.startsWith('@vp/') || text === 'fastify'
        ? ts.resolveModuleName(text, containingFile, options, host, undefined, redirected)
        : { resolvedModule: undefined }
    );
  return host;
}

/** One program over every server-side production source, built once per suite run. */
export function serverProgram(roots: readonly string[]): ts.Program {
  shared ??= ts.createProgram(
    roots.map((file) => join(ROOT, file)),
    OPTIONS,
    workspaceOnlyHost()
  );
  return shared;
}

/** A program over in-memory files, for the fixture that proves an assertion fires. */
export function fixtureProgram(files: Record<string, string>): ts.Program {
  const host = ts.createCompilerHost(OPTIONS);
  const read = host.readFile.bind(host);
  host.readFile = (file) => files[file] ?? read(file);
  host.fileExists = (file) => Object.hasOwn(files, file) || ts.sys.fileExists(file);
  host.directoryExists = (dir) =>
    Object.keys(files).some((file) => file.startsWith(`${dir}/`)) || ts.sys.directoryExists(dir);
  host.getSourceFile = (file, version) => {
    const text = files[file] ?? ts.sys.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, version, true);
  };
  return ts.createProgram(Object.keys(files), { ...OPTIONS, paths: {} }, host);
}
