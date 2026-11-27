import ts from 'typescript';
import { isPlatform, load, type Pkg } from '../../scripts/workspace-packages';
import { parseSource } from './parsed-sources';
import { productionSources, trackedFiles } from './repo-files';

let packages: Pkg[] | undefined;

export function platformPackages(): Pkg[] {
  packages ??= load().filter(({ dir }) => isPlatform(dir));
  return packages;
}

/** Non-test source of every package under `packages/platform/`, whichever of them exist. */
export function platformSources(): string[] {
  return productionSources().filter(isPlatform);
}

/** Every TypeScript file under `packages/platform/`, specs and configs included. */
export function platformFiles(): string[] {
  return trackedFiles('packages/platform').filter(
    (file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts')
  );
}

/** Every module a file names, through the compiler's own scanner: imports, re-exports, `import()` and `require`. */
export function moduleSpecifiers(source: string): string[] {
  return ts.preProcessFile(source, true, true).importedFiles.map(({ fileName }) => fileName);
}

/** The text of every string-like leaf: literals, template parts and JSX text. */
export function stringTexts(file: string, source: string): string[] {
  const texts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      texts.push(node.text);
    } else if (ts.isJsxText(node)) {
      texts.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return texts;
}
