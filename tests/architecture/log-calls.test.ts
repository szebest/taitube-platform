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
  const receiver = callee.expression.getText().replace(/\?$/, '');
  return LOGGER_NAME.test(receiver);
}

function messageProblem(message: ts.Expression): string | undefined {
  if (ts.isTemplateExpression(message)) return 'interpolates into its message';
  if (ts.isBinaryExpression(message) && message.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return 'concatenates its message';
  }
  const isText = ts.isStringLiteral(message) || ts.isNoSubstitutionTemplateLiteral(message);
  if (isText && /^[A-Z][a-z]/.test(message.text)) return 'starts its message in sentence case';
  return undefined;
}

function logCallProblems(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isLoggerCall(node)) {
      const message = node.arguments.at(-1);
      const problem = message ? messageProblem(message) : undefined;
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
].join('\n');

describe('architecture: log calls carry a fixed message and structured fields', () => {
  it.each([
    [2, 'interpolates into its message'],
    [3, 'concatenates its message'],
    [4, 'starts its message in sentence case'],
  ])('fires on line %i, which %s', (line, problem) => {
    expect(logCallProblems('fixture.ts', FIXTURE)).toContain(`fixture.ts:${line}: ${problem}`);
  });

  it('leaves a fixed message, an acronym and a call that is not a log alone', () => {
    expect(logCallProblems('fixture.ts', FIXTURE)).toHaveLength(3);
  });

  it('finds none in production source, scripts or the e2e runner', () => {
    const files = [...productionSources(), ...trackedFiles(':(glob)tests/e2e/*.ts')];

    expect(files.flatMap((file) => logCallProblems(file, read(file)))).toEqual([]);
  });
});
