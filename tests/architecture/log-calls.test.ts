import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read, trackedFiles } from './repo-files';

const LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/** `log`, `logger`, `this.log`, `request.log`, `deps.logger`: what a logger is called here. */
const LOGGER_NAME = /(^|\.)(log|logger)$/i;

function isLoggerCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  if (!LEVELS.has(callee.name.text)) return false;
  return LOGGER_NAME.test(callee.expression.getText());
}

function isText(node: ts.Expression): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function isConcatenation(node: ts.Expression): boolean {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;
}

/**
 * Pino takes `(fields, message, ...args)` or `(message, ...args)`. A lone argument that is not an
 * object literal is read as the message, so `log.error(err)` is held to the same rule.
 */
function messageIndex(args: ts.NodeArray<ts.Expression>): number | undefined {
  const [first] = args;
  if (first === undefined) return undefined;
  if (isText(first) || ts.isTemplateExpression(first) || isConcatenation(first)) return 0;
  if (args.length === 1) return ts.isObjectLiteralExpression(first) ? undefined : 0;
  return 1;
}

function messageProblem(args: ts.NodeArray<ts.Expression>): string | undefined {
  const index = messageIndex(args);
  if (index === undefined) return undefined;
  const message = args[index];
  if (message === undefined) return undefined;
  if (ts.isTemplateExpression(message)) return 'interpolates into its message';
  if (isConcatenation(message)) return 'concatenates its message';
  if (!isText(message)) return 'passes a message that is not a literal';
  if (args.length > index + 1) return 'formats its message printf-style';
  if (/^[A-Z][a-z]/.test(message.text)) return 'starts its message in sentence case';
  return undefined;
}

function logCallProblems(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isLoggerCall(node)) {
      const problem = messageProblem(node.arguments);
      if (problem) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        problems.push(`${file}:${line + 1}: ${problem}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return problems;
}

const FIXTURE = [
  "log.info({ videoId }, 'probe queued');",
  'log.warn(`probe of ${videoId} failed`);',
  "this.logger.error({ err }, 'probe of ' + videoId + ' failed');",
  "request.log.info('Probe job started');",
  "logger?.warn({ reason }, 'FFmpeg exited 137');",
  'cache.set(key, `${a}${b}`);',
  "log.info('probe %s queued', videoId);",
  'log.info({ videoId }, message);',
  'log.error(err);',
  'log.info({ videoId, attempt: 2 });',
].join('\n');

describe('architecture: log calls carry a fixed message and structured fields', () => {
  it.each([
    [2, 'interpolates into its message'],
    [3, 'concatenates its message'],
    [4, 'starts its message in sentence case'],
    [7, 'formats its message printf-style'],
    [8, 'passes a message that is not a literal'],
    [9, 'passes a message that is not a literal'],
  ])('fires on line %i, which %s', (line, problem) => {
    expect(logCallProblems('fixture.ts', FIXTURE)).toContain(`fixture.ts:${line}: ${problem}`);
  });

  it('leaves a fixed message, an acronym, fields alone and a call that is not a log alone', () => {
    expect(logCallProblems('fixture.ts', FIXTURE)).toHaveLength(6);
  });

  it('finds none in production source, scripts or the e2e runner', () => {
    const files = [...productionSources(), ...trackedFiles(':(glob)tests/e2e/*.ts')];

    expect(files.flatMap((file) => logCallProblems(file, read(file)))).toEqual([]);
  });
});
