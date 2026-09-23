import { join } from 'node:path';
import ts from 'typescript';
import { ROOT } from './repo-files';
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
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  baseUrl: ROOT,
  paths: workspacePaths(),
};

const programs = new Map<string, ts.Program>();

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

/** Built once per set of roots, so the type-aware assertions over the same sources share it. */
export function serverProgram(roots: readonly string[]): ts.Program {
  const key = [...roots].sort().join('\n');
  const built = programs.get(key);
  if (built) return built;

  const program = ts.createProgram(
    roots.map((file) => join(ROOT, file)),
    OPTIONS,
    workspaceOnlyHost()
  );
  programs.set(key, program);
  return program;
}

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
