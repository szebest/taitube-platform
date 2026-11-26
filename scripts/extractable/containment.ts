import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE = /\.[cm]?[jt]sx?$/;
const GLOB = /[*?{[]/;

export const isInside = (root: string, path: string): boolean => {
  const fromRoot = relative(root, path);
  return !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
};

/** The paths of `paths` that are not inside `root`, compared after `realpath`, so a symlink counts where it points. */
export const outside = (root: string, paths: readonly string[]): string[] =>
  paths.filter((path) => !isInside(root, path));

const isPathLike = (value: string): boolean =>
  value === '.' || value === '..' || /^\.\.?\//.test(value) || isAbsolute(value);

/** A glob stops being a path at its first wildcard; `src/**\/*.ts` leaves the folder only if `src` does. */
function staticPrefix(value: string): string {
  const segments = value.split('/');
  const firstGlob = segments.findIndex((segment) => GLOB.test(segment));
  const fixed = firstGlob === -1 ? segments : segments.slice(0, firstGlob);
  return fixed.join('/') || '.';
}

function sourceSpecifiers(text: string): string[] {
  const { importedFiles, referencedFiles } = ts.preProcessFile(text, true, true);
  return [...importedFiles, ...referencedFiles].map(({ fileName }) => fileName);
}

const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
};

function tsconfigPaths(text: string): string[] {
  const { config } = ts.parseConfigFileTextToJson('tsconfig.json', text);
  const options = config?.compilerOptions ?? {};
  return [
    ...stringsIn(config?.extends),
    ...stringsIn(config?.references),
    ...stringsIn(config?.files),
    ...stringsIn(config?.include),
    ...stringsIn(config?.exclude),
    ...stringsIn([options.rootDir, options.outDir, options.baseUrl, options.typeRoots]),
    ...stringsIn(options.paths),
  ].filter((value) => !value.includes('${'));
}

function manifestPaths(text: string): string[] {
  const manifest = JSON.parse(text);
  return stringsIn([
    manifest.main,
    manifest.types,
    manifest.module,
    manifest.bin,
    manifest.exports,
  ]);
}

function referencedPaths(file: string, text: string): string[] {
  const name = file.split('/').at(-1) ?? file;
  if (name === 'package.json') return manifestPaths(text);
  if (/^tsconfig.*\.json$/.test(name)) return tsconfigPaths(text);
  if (SOURCE.test(name)) return sourceSpecifiers(text);
  return [];
}

/**
 * Every path a package file names (an import, a triple-slash reference, a tsconfig `extends`,
 * `references` or `include`, a manifest `exports` target) that resolves outside the package folder.
 * `file` is relative to `packageRoot`. A package specifier is left to the resolver, which the
 * realpath check covers.
 */
export function escapingPaths(packageRoot: string, file: string, text: string): string[] {
  const from = dirname(join(packageRoot, file));
  return referencedPaths(file, text)
    .filter(isPathLike)
    .filter((value) => !isInside(packageRoot, resolve(from, staticPrefix(value))))
    .map((value) => `${file}: ${value} leaves the package folder`);
}

/** Each line of a copied file that names an app package. */
export function appReferences(file: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      line.includes('@vp/') ? [`${file}:${index + 1}: names an app package: ${line.trim()}`] : []
    );
}
