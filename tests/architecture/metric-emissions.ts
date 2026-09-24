import ts from 'typescript';
import { read } from './repo-files';

/** A label whose value is computed at run time rather than chosen from a fixed set. */
export const ANY_VALUE = 'any';

export type LabelValues = Set<string> | typeof ANY_VALUE;

export interface RegisteredMetric {
  field: string;
  /** The names a scrape exposes: a histogram adds `_bucket`, `_count` and `_sum`. */
  series: string[];
}

const METRICS_MODULE = 'packages/server/observability/src/metrics.ts';
const HISTOGRAM_SERIES = ['_bucket', '_count', '_sum'];
const RECORDING_METHODS = new Set(['inc', 'dec', 'set', 'observe']);

/** Every metric `createMetricsRegistry` builds, read from `new Kind({ name })` in its module. */
export function registeredMetrics(source = read(METRICS_MODULE)): RegisteredMetric[] {
  const file = ts.createSourceFile(METRICS_MODULE, source, ts.ScriptTarget.ES2022, true);
  const found: RegisteredMetric[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isNewExpression(node.initializer)
    ) {
      const [options] = node.initializer.arguments ?? [];
      const name =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find(
              (p): p is ts.PropertyAssignment =>
                ts.isPropertyAssignment(p) && p.name.getText() === 'name'
            )?.initializer
          : undefined;
      if (name && ts.isStringLiteral(name)) {
        const histogram = node.initializer.expression.getText() === 'Histogram';
        found.push({
          field: node.name.text,
          series: histogram ? HISTOGRAM_SERIES.map((s) => name.text + s) : [name.text],
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function literalValues(checker: ts.TypeChecker, expression: ts.Expression): LabelValues {
  const type = checker.getTypeAtLocation(expression);
  const members = type.isUnion() ? type.types : [type];
  const values = new Set<string>();
  for (const member of members) {
    if (member.isStringLiteral()) values.add(member.value);
    else if (member.isNumberLiteral()) values.add(String(member.value));
    else return ANY_VALUE;
  }
  return values;
}

/** The label object a recording call is handed, followed through one `const labels = {...}`. */
function labelObject(
  checker: ts.TypeChecker,
  argument: ts.Expression
): ts.ObjectLiteralExpression | undefined {
  if (ts.isObjectLiteralExpression(argument)) return argument;
  if (!ts.isIdentifier(argument)) return undefined;

  const declaration = checker.getSymbolAtLocation(argument)?.valueDeclaration;
  if (!(declaration && ts.isVariableDeclaration(declaration))) return undefined;

  const { initializer } = declaration;
  if (!(initializer && ts.isObjectLiteralExpression(initializer))) return undefined;
  return initializer;
}

function merge(into: Map<string, LabelValues>, label: string, values: LabelValues): void {
  const existing = into.get(label);
  if (existing === ANY_VALUE || values === ANY_VALUE) {
    into.set(label, ANY_VALUE);
    return;
  }
  into.set(label, new Set([...(existing ?? []), ...values]));
}

/**
 * The label values every `metrics.<field>.inc|dec|set|observe(labels, ...)` in the program can
 * record, keyed by registry field: a literal, a union of literals, or `any` for a computed string.
 */
export function emittedLabels(
  program: ts.Program,
  files: readonly ts.SourceFile[],
  fields: ReadonlySet<string>
): Map<string, Map<string, LabelValues>> {
  const checker = program.getTypeChecker();
  const emitted = new Map<string, Map<string, LabelValues>>();

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      RECORDING_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      fields.has(node.expression.expression.name.text)
    ) {
      const field = node.expression.expression.name.text;
      const labels = emitted.get(field) ?? new Map<string, LabelValues>();
      emitted.set(field, labels);
      const [first] = node.arguments;
      const object = first ? labelObject(checker, first) : undefined;
      for (const property of object?.properties ?? []) {
        if (ts.isPropertyAssignment(property)) {
          merge(labels, property.name.getText(), literalValues(checker, property.initializer));
        } else if (ts.isShorthandPropertyAssignment(property)) {
          merge(labels, property.name.text, literalValues(checker, property.name));
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  for (const file of files) visit(file);
  return emitted;
}
