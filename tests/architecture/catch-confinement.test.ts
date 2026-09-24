import ts from 'typescript';
import { ENTRYPOINTS, isListed } from './entrypoints';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * `tryCatch` / `fromPromise` in `@vp/result` and the adapters that call them are where a throwing
 * SDK becomes a `Result`, and an entrypoint's top-level handler is where a failure becomes an exit
 * code. Everywhere else a `catch` is control flow that cannot tell intent from fault, which is what
 * let `channel-service.ts` turn a dead database into a channel-less user.
 */
const CATCH_HOMES = ['packages/universal/result/', 'packages/server/adapters/'];

const CATCH = /(^|[^\w.])catch\s*[({]|\.catch\s*\(|\?\.catch\?\.\s*\(/;

function catches(source: string): boolean {
  return CATCH.test(source);
}

/** `.then(onFulfilled, onRejected)` is a `.catch(` by another name; the second argument gives it away. */
function rejectionHandlers(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'then' &&
      node.arguments.length >= 2
    ) {
      found.push(`${file}: ${node.getText().split('\n')[0]}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function isHome(file: string): boolean {
  return CATCH_HOMES.some((home) => file.startsWith(home)) || isListed(file, ENTRYPOINTS);
}

describe('architecture: catch is confined to the boundary that converts a throw', () => {
  it.each([
    { shape: 'a try/catch block', source: 'try { await run(); } catch (e) { log(e); }' },
    { shape: 'a bare catch clause', source: 'try { run(); } catch {}' },
    { shape: 'a method catch', source: 'await storage.deleteObject(bucket, key).catch(() => {});' },
    { shape: 'an optional method catch', source: 'job.updateProgress?.(10)?.catch?.(() => {});' },
  ])('recognises $shape', ({ source }) => {
    expect(catches(source)).toBe(true);
  });

  it.each([
    { shape: 'a Result boundary', source: 'const r = await fromPromise(() => run(), toFailure);' },
    { shape: 'a word that only contains catch', source: 'const catchAll = matcher.catchAll;' },
  ])('leaves $shape alone', ({ source }) => {
    expect(catches(source)).toBe(false);
  });

  it.each([
    {
      shape: 'an undefined success handler',
      source: 'const n = await load().then(undefined, () => 0);',
    },
    {
      shape: 'a handler pair across lines',
      source: 'void run()\n  .then(\n    (v) => v,\n    (cause) => report(cause)\n  );',
    },
  ])('recognises a rejection handler passed to then: $shape', ({ source }) => {
    expect(rejectionHandlers('fixture.ts', source)).toHaveLength(1);
  });

  it('leaves a then with only a success handler alone', () => {
    expect(rejectionHandlers('fixture.ts', 'const v = await load().then((x) => x + 1);')).toEqual(
      []
    );
  });

  it('still sees the catches the boundary legitimately makes', () => {
    expect(catches(read('packages/universal/result/src/try-catch.ts'))).toBe(true);
  });

  it('finds no catch outside @vp/result, an adapter or an entrypoint', () => {
    expect(productionSources().filter((file) => !isHome(file) && catches(read(file)))).toEqual([]);
  });

  it('finds no rejection handler passed to then outside an entrypoint', () => {
    const offenders = productionSources()
      .filter((file) => !isListed(file, ENTRYPOINTS))
      .flatMap((file) => rejectionHandlers(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
