import { ErrorCodes } from '@vp/errors';
import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read, trackedFiles } from './repo-files';

/**
 * A failure's code is a member of `ErrorCode` or it is a second vocabulary. `'ORPHANED'` and
 * `'UNRECOVERABLE_ERROR'` were both persisted before either was a code, and nothing noticed.
 */
const VOCABULARY: ReadonlySet<string> = new Set(Object.values(ErrorCodes));
const CODE_KEYS: ReadonlySet<string> = new Set(['code', 'errorCode', 'error_code']);

/** The browser tiers answer to their own transport, and persist nothing. */
const SERVER_SOURCE = /^(apps\/(api|worker)|packages\/(server|universal)|scripts)\//;

/** A metric's labels are not a failure: `ffmpeg_exit_total{code="137"}` is an exit status. */
const METRIC_WRITES: ReadonlySet<string> = new Set(['inc', 'dec', 'set', 'observe']);

function isMetricLabel(node: ts.Node): boolean {
  const call = node.parent.parent;
  return (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    METRIC_WRITES.has(call.expression.name.text)
  );
}

function strangers(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      CODE_KEYS.has(node.name.getText()) &&
      ts.isStringLiteralLike(node.initializer) &&
      !VOCABULARY.has(node.initializer.text) &&
      !isMetricLabel(node)
    ) {
      found.push(`${file}: ${node.getText()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** What a repository is asked to persist types its code as `ErrorCode`, never as `string`. */
function untypedWrites(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  return sourceFile.statements
    .filter(ts.isInterfaceDeclaration)
    .filter(({ name }) => /(Options|Input)$/.test(name.text))
    .flatMap((declaration) =>
      declaration.members
        .filter(ts.isPropertySignature)
        .filter((member) => member.name.getText() === 'errorCode')
        .filter((member) => !/\bErrorCode\b/.test(member.type?.getText() ?? ''))
        .map((member) => `${file}: ${declaration.name.text}.${member.getText()}`)
    );
}

describe('architecture: every persisted error code is an ErrorCode', () => {
  it.each([
    { shape: 'an invented code', source: "const patch = { errorCode: 'ORPHANED_VIDEO' };" },
    { shape: 'a stringly failure', source: "return { code: 'UNRECOVERABLE_ERROR', message };" },
  ])('recognises $shape', ({ source }) => {
    expect(strangers('fixture.ts', source)).toHaveLength(1);
  });

  it('leaves a metric label alone', () => {
    const labelled = "metrics.ffmpegExitTotal.inc({ stage, code: '137' });";

    expect(strangers('fixture.ts', labelled)).toEqual([]);
  });

  it('leaves a vocabulary code alone, however it is spelt', () => {
    expect(
      strangers('fixture.ts', "const f = { code: 'ORPHANED', errorCode: ErrorCodes.INTERNAL };")
    ).toEqual([]);
  });

  it('recognises a write option that types its code as a string', () => {
    const contract = 'export interface FailStepOptions { videoId: string; errorCode: string; }';

    expect(untypedWrites('fixture.ts', contract)).toHaveLength(1);
    expect(
      untypedWrites('fixture.ts', contract.replace('errorCode: string', 'errorCode: ErrorCode'))
    ).toEqual([]);
  });

  it('finds no code outside the vocabulary in server-side production source', () => {
    const server = productionSources().filter((file) => SERVER_SOURCE.test(file));

    expect(server.flatMap((file) => strangers(file, read(file)))).toEqual([]);
  });

  it('types every repository write of an error code as ErrorCode', () => {
    const contracts = trackedFiles('packages/server/core/repositories').filter((file) =>
      file.endsWith('.ts')
    );

    expect(contracts.flatMap((file) => untypedWrites(file, read(file)))).toEqual([]);
  });
});
