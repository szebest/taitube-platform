import ts from 'typescript';
import { parseSource } from './parsed-sources';

const EMPTY_CLASS = /^export (?:default )?class \w+(?: extends [\w.]+)? \{\s*\}$/gm;
const IMPORT = /^import [^;]+;$/gm;

function isDeclared(statement: ts.Statement): boolean {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
  return (modifiers ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword);
}

/** A statement no emit drops: reading it settles the question without a transpile. */
function isAlwaysEmitted(statement: ts.Statement): boolean {
  if (ts.isExpressionStatement(statement)) return true;
  if (ts.isFunctionDeclaration(statement)) return statement.body !== undefined;
  return ts.isVariableStatement(statement) && !isDeclared(statement);
}

/**
 * Whether a module does anything once its types are erased. An abstract class whose members are
 * all abstract erases to an empty shell, which is a declaration here, not behaviour to test.
 */
export function hasRuntimeCode(file: string, source: string): boolean {
  if (parseSource(file, source).statements.some(isAlwaysEmitted)) return true;

  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
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
