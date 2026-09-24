import ts from 'typescript';

const parsed = new Map<string, ts.SourceFile>();

/**
 * The syntax tree of `source`, parsed once per process: a dozen assertions walk the same files,
 * and parsing them again in each is most of what an AST assertion costs.
 */
export function parseSource(file: string, source: string): ts.SourceFile {
  const cached = parsed.get(file);
  if (cached && cached.text === source) return cached;

  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  parsed.set(file, sourceFile);
  return sourceFile;
}
