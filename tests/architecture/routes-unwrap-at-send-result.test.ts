import { productionSources, read, shrinkOnly } from './repo-files';
import { ROUTES_OUTSIDE_SEND_RESULT } from './routes-outside-send-result';

/**
 * W6: `sendResult` is the only place a route unwraps a `Result`, and a route holds no rule. The
 * acceptance criterion said "asserted by W8", and nothing asserted it: `no-domain-throw`'s roots
 * are `services/` and `stages/`, so `routes/uploads.ts` turned a validation failure into a
 * `throw new PermanentError` and `routes/admin/queues.ts` caught one, both unremarked.
 */
const ROUTES = 'apps/api/src/routes/';

const THROW = /(^|[^\w.])throw\s+/;
const ASSERT_NEVER = /(^|[^\w.])throw\s+assertNever\b/;
const CATCH = /(^|[^\w.])catch\s*[({]/;

/**
 * A port or repository type under `routes/` means the route reached past its service. `health.ts`
 * is the exception and stays one: liveness reports on the adapters themselves, so the ports are
 * its subject rather than a shortcut around a service.
 */
const PORTS = /from '(@vp\/core\/(ports|repositories)|@vp\/adapters)'/;
const PORT_EXEMPT = [`${ROUTES}health.ts`];

function routeSources(): string[] {
  return productionSources().filter((file) => file.startsWith(ROUTES));
}

function unwrapsOutsideSendResult(source: string): boolean {
  return source
    .split('\n')
    .some((line) => (THROW.test(line) && !ASSERT_NEVER.test(line)) || CATCH.test(line));
}

describe('architecture: a route hands its Result to sendResult and renders nothing itself', () => {
  it('reads the route tree it is asserting about', () => {
    expect(routeSources().length).toBeGreaterThan(10);
  });

  it('finds no route turning a Result into a throw or a catch', () => {
    const offenders = routeSources().filter((file) => unwrapsOutsideSendResult(read(file)));

    expect(shrinkOnly(offenders, ROUTES_OUTSIDE_SEND_RESULT).unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that no longer unwraps', () => {
    const offenders = routeSources().filter((file) => unwrapsOutsideSendResult(read(file)));

    expect(shrinkOnly(offenders, ROUTES_OUTSIDE_SEND_RESULT).stale).toEqual([]);
  });

  it('finds no route importing a port, a repository or an adapter', () => {
    const offenders = routeSources()
      .filter((file) => !PORT_EXEMPT.includes(file))
      .filter((file) => PORTS.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it.each([
    { shape: 'a throw', source: '  throw new PermanentError(e.code, e.message);' },
    { shape: 'a catch clause', source: '  } catch (err) {' },
    { shape: 'a bare catch', source: '  } catch {' },
  ])('recognises $shape as unwrapping outside the seam', ({ source }) => {
    expect(unwrapsOutsideSendResult(source)).toBe(true);
  });

  it.each([
    { shape: 'sendResult', source: '  return sendResult(reply, request, result);' },
    { shape: 'an isErr short-circuit', source: '  if (isErr(page)) return sendResult(r, q, page);' },
    { shape: 'a value read after that guard', source: '  reply.headers(page.value.headers);' },
    { shape: 'a promise catch on a fetch', source: "  const x = await f().catch(() => null);" },
    { shape: 'an exhaustiveness assertion', source: '  throw assertNever(f, "present");' },
  ])('leaves $shape alone', ({ source }) => {
    expect(unwrapsOutsideSendResult(source)).toBe(false);
  });
});
