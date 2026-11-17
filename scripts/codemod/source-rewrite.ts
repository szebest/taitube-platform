import ts from 'typescript';
import { type Moves, resolveSpecifier } from './moves';

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface SourceRewrite {
  readonly text: string;
  readonly problems: readonly string[];
}

interface Piece {
  readonly kind: 'default' | 'named';
  readonly sourceName: string;
  readonly text: string;
}

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
};

const MOCK_CALLS: ReadonlySet<string> = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);

export const isRewritableSource = (file: string): boolean =>
  Object.keys(SCRIPT_KINDS).some((extension) => file.endsWith(extension));

const quoteOf = (literal: ts.StringLiteral): string => literal.getText()[0] ?? "'";

const literalEdit = (literal: ts.StringLiteral, specifier: string): Edit => ({
  start: literal.getStart() + 1,
  end: literal.getEnd() - 1,
  text: specifier,
});

function groupByDestination(
  pieces: readonly Piece[],
  destinationOf: (name: string) => string
): Map<string, Piece[]> {
  const groups = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const destination = destinationOf(piece.sourceName);
    groups.set(destination, [...(groups.get(destination) ?? []), piece]);
  }
  return groups;
}

function clauseText(pieces: readonly Piece[], typeOnly: boolean): string {
  const defaults = pieces.filter((piece) => piece.kind === 'default').map((piece) => piece.text);
  const named = pieces.filter((piece) => piece.kind === 'named').map((piece) => piece.text);
  const bindings = named.length > 0 ? `{ ${named.join(', ')} }` : '';
  const clause = [...defaults, bindings].filter(Boolean).join(', ');
  return typeOnly ? `type ${clause}` : clause;
}

class Rewriter {
  readonly edits: Edit[] = [];
  readonly problems: string[] = [];

  constructor(
    private readonly file: ts.SourceFile,
    private readonly moves: Moves
  ) {}

  private problem(node: ts.Node, message: string): void {
    const { line } = this.file.getLineAndCharacterOfPosition(node.getStart());
    this.problems.push(`${this.file.fileName}:${line + 1}: ${message}`);
  }

  private wholeSpecifier(literal: ts.StringLiteral, what: string): void {
    const resolution = resolveSpecifier(this.moves, literal.text);
    if (resolution.kind === 'unchanged') return;
    if (resolution.kind === 'whole') {
      this.edits.push(literalEdit(literal, resolution.specifier));
      return;
    }
    if (resolution.every.length === 1 && resolution.every[0]) {
      this.edits.push(literalEdit(literal, resolution.every[0]));
      return;
    }
    this.problem(
      literal,
      `${what} of '${literal.text}' cannot be split across ${resolution.every.join(', ')}: rewrite by hand`
    );
  }

  private splitDeclaration(
    node: ts.ImportDeclaration | ts.ExportDeclaration,
    literal: ts.StringLiteral,
    pieces: readonly Piece[],
    typeOnly: boolean,
    keyword: 'import' | 'export'
  ): void {
    const resolution = resolveSpecifier(this.moves, literal.text);
    if (resolution.kind === 'unchanged') return;
    if (resolution.kind === 'whole') {
      this.edits.push(literalEdit(literal, resolution.specifier));
      return;
    }

    const groups = groupByDestination(pieces, resolution.of);
    const [first] = groups.keys();
    if (groups.size === 1 && first !== undefined) {
      if (first !== literal.text) this.edits.push(literalEdit(literal, first));
      return;
    }

    const quote = quoteOf(literal);
    const semicolon = node.getText().endsWith(';') ? ';' : '';
    const indent = ' '.repeat(this.file.getLineAndCharacterOfPosition(node.getStart()).character);
    const lines = [...groups].map(
      ([destination, group]) =>
        `${keyword} ${clauseText(group, typeOnly)} from ${quote}${destination}${quote}${semicolon}`
    );
    this.edits.push({
      start: node.getStart(),
      end: node.getEnd(),
      text: lines.join(`\n${indent}`),
    });
  }

  private importDeclaration(node: ts.ImportDeclaration): void {
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    if (!clause || (bindings && ts.isNamespaceImport(bindings))) {
      this.wholeSpecifier(node.moduleSpecifier, 'the namespace or side-effect import');
      return;
    }
    const pieces: Piece[] = [];
    if (clause.name) {
      pieces.push({ kind: 'default', sourceName: 'default', text: clause.name.text });
    }
    for (const element of bindings?.elements ?? []) {
      const sourceName = (element.propertyName ?? element.name).text;
      const alias = element.propertyName ? `${sourceName} as ${element.name.text}` : sourceName;
      pieces.push({
        kind: 'named',
        sourceName,
        text: `${element.isTypeOnly ? 'type ' : ''}${alias}`,
      });
    }
    this.splitDeclaration(node, node.moduleSpecifier, pieces, clause.isTypeOnly, 'import');
  }

  private exportDeclaration(node: ts.ExportDeclaration): void {
    const literal = node.moduleSpecifier;
    if (!(literal && ts.isStringLiteral(literal))) return;
    const clause = node.exportClause;
    if (!(clause && ts.isNamedExports(clause))) {
      this.wholeSpecifier(literal, 'the star re-export');
      return;
    }
    const pieces: Piece[] = clause.elements.map((element) => {
      const sourceName = (element.propertyName ?? element.name).text;
      const alias = element.propertyName ? `${sourceName} as ${element.name.text}` : sourceName;
      return { kind: 'named', sourceName, text: `${element.isTypeOnly ? 'type ' : ''}${alias}` };
    });
    this.splitDeclaration(node, literal, pieces, node.isTypeOnly, 'export');
  }

  private call(node: ts.CallExpression): void {
    const [first] = node.arguments;
    if (!(first && ts.isStringLiteral(first))) return;
    const callee = node.expression;
    if (callee.kind === ts.SyntaxKind.ImportKeyword) {
      this.wholeSpecifier(first, 'the dynamic import');
    } else if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'vi' &&
      MOCK_CALLS.has(callee.name.text)
    ) {
      this.wholeSpecifier(first, `vi.${callee.name.text}`);
    }
  }

  visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) this.importDeclaration(node);
    else if (ts.isExportDeclaration(node)) this.exportDeclaration(node);
    else if (ts.isCallExpression(node)) this.call(node);
    else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      this.wholeSpecifier(node.argument.literal, 'the import type');
    }
    ts.forEachChild(node, this.visit);
  };
}

export function rewriteSource(fileName: string, text: string, moves: Moves): SourceRewrite {
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  const file = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    SCRIPT_KINDS[extension] ?? ts.ScriptKind.TS
  );
  const rewriter = new Rewriter(file, moves);
  rewriter.visit(file);

  const rewritten = [...rewriter.edits]
    .sort((a, b) => b.start - a.start)
    .reduce((out, edit) => out.slice(0, edit.start) + edit.text + out.slice(edit.end), text);

  return { text: rewritten, problems: rewriter.problems };
}
