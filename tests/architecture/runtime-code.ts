import ts from 'typescript';

const EMPTY_CLASS = /^export (?:default )?class \w+(?: extends [\w.]+)? \{\s*\}$/gm;
const IMPORT = /^import [^;]+;$/gm;

/**
 * Whether a module does anything once its types are erased. An abstract class whose members are
 * all abstract erases to an empty shell, which is a declaration here, not behaviour to test.
 */
export function hasRuntimeCode(source: string): boolean {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  });

  return (
    outputText
      .replace(/\/\/# sourceMappingURL=.*$/m, '')
      .replace(IMPORT, '')
      .replace(/^export \{\};$/m, '')
      .replace(EMPTY_CLASS, '')
      .trim() !== ''
  );
}
