import ts from 'typescript';

const FORMAT =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const printer = ts.createPrinter({ removeComments: true });

const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A type the checker could only name by the file it came from reads the same on every machine. */
const portable = (text: string): string => text.replaceAll(/import\("[^"]*"\)\./g, '');

const asDeclaration = (text: string): string =>
  `export ${text.replace(/^(?:export\s+|declare\s+)+/, '')}`;

const isHidden = (symbol: ts.Symbol): boolean =>
  (symbol.declarations ?? []).some(
    (declaration) =>
      ts.canHaveModifiers(declaration) &&
      (ts.getCombinedModifierFlags(declaration) &
        (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !==
        0
  ) || symbol.name.startsWith('#');

class Surface {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly scope: ts.SourceFile
  ) {}

  private typeText(type: ts.Type): string {
    return portable(this.checker.typeToString(type, this.scope, FORMAT));
  }

  private signatureText(signature: ts.Signature): string {
    return portable(this.checker.signatureToString(signature, this.scope, FORMAT));
  }

  private memberLines(type: ts.Type, prefix: string): string[] {
    return this.checker
      .getPropertiesOfType(type)
      .filter((property) => !(isHidden(property) || property.name === 'prototype'))
      .sort((a, b) => compareNames(a.name, b.name))
      .map((property) => {
        const optional = property.flags & ts.SymbolFlags.Optional ? '?' : '';
        const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? this.scope;
        const propertyType = this.checker.getTypeOfSymbolAtLocation(property, declaration);
        return `  ${prefix}${property.name}${optional}: ${this.typeText(propertyType)}`;
      });
  }

  private classLines(name: string, symbol: ts.Symbol): string[] {
    const declaration = symbol.valueDeclaration ?? this.scope;
    const instance = this.checker.getDeclaredTypeOfSymbol(symbol);
    const constructor = this.checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const constructors = constructor
      .getConstructSignatures()
      .map((signature) => `  constructor${this.signatureText(signature)}`);
    return [
      `export class ${name}${this.typeText(instance).slice(name.length)}`,
      ...constructors,
      ...this.memberLines(constructor, 'static '),
      ...this.memberLines(instance, ''),
    ];
  }

  private namespaceLines(name: string, symbol: ts.Symbol): string[] {
    const members = this.checker.getExportsOfModule(symbol);
    return [
      `export namespace ${name}`,
      ...members.flatMap((member) => this.lines(member).map((line) => `  ${line}`)),
    ];
  }

  private declarationLines(symbol: ts.Symbol): string[] {
    return (symbol.declarations ?? [])
      .filter(
        (declaration) =>
          ts.isInterfaceDeclaration(declaration) ||
          ts.isTypeAliasDeclaration(declaration) ||
          ts.isEnumDeclaration(declaration)
      )
      .map((declaration) =>
        asDeclaration(
          printer.printNode(ts.EmitHint.Unspecified, declaration, declaration.getSourceFile())
        )
      );
  }

  lines(exported: ts.Symbol): string[] {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(exported) : exported;
    const name = exported.name;
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) return [`export ${name}: unresolved`];

    const { flags } = symbol;
    const lines = this.declarationLines(symbol);
    if (flags & ts.SymbolFlags.Class) lines.push(...this.classLines(name, symbol));
    else if (flags & ts.SymbolFlags.Function) {
      const type = this.checker.getTypeOfSymbolAtLocation(symbol, declaration);
      lines.push(
        ...type
          .getCallSignatures()
          .map((signature) => `export function ${name}${this.signatureText(signature)}`)
      );
    } else if (flags & ts.SymbolFlags.Variable) {
      const type = this.checker.getTypeOfSymbolAtLocation(symbol, declaration);
      lines.push(`export const ${name}: ${this.typeText(type)}`);
    } else if (flags & ts.SymbolFlags.Module && lines.length === 0) {
      lines.push(...this.namespaceLines(name, symbol));
    }
    return lines.length > 0 ? lines : [`export ${name}`];
  }
}

/** The names a module exports with their types, one block per name, sorted: the surface a consumer can depend on. */
export function surfaceOf(program: ts.Program, entry: string): string[] {
  const scope = program.getSourceFile(entry);
  const checker = program.getTypeChecker();
  const moduleSymbol = scope && checker.getSymbolAtLocation(scope);
  if (!(scope && moduleSymbol)) return [];

  const surface = new Surface(checker, scope);
  return checker
    .getExportsOfModule(moduleSymbol)
    .sort((a, b) => compareNames(a.name, b.name))
    .flatMap((exported) => surface.lines(exported));
}
